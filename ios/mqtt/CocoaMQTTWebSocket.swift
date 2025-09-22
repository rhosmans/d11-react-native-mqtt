//
//  CocoaMQTTWebSocket.swift
//  d11-mqtt
//
//  WebSocket implementation for CocoaMQTT using Starscream
//

import Foundation
import CocoaMQTT
import Starscream

public class CocoaMQTTWebSocket: NSObject, CocoaMQTTSocketProtocol {
    
    public var enableSSL: Bool = false {
        didSet {
            if let url = socketURL {
                configureWebSocket(url: url)
            }
        }
    }
    
    private weak var delegate: CocoaMQTTSocketDelegate?
    private var delegateQueue: DispatchQueue?
    private var webSocket: WebSocket?
    private var socketURL: URL?
    
    // Buffer management for incremental reading
    private var readBuffer: Data = Data()
    private var pendingReads: [(length: UInt, tag: Int)] = []
    private let bufferQueue = DispatchQueue(label: "CocoaMQTTWebSocket.buffer", qos: .default)
    
    public var uri: String = "/mqtt"
    public var headers: [String: String] = [:]
    
    public convenience init(uri: String) {
        self.init()
        self.uri = uri
    }
    
    public func setDelegate(_ theDelegate: CocoaMQTTSocketDelegate?, delegateQueue: DispatchQueue?) {
        self.delegate = theDelegate
        self.delegateQueue = delegateQueue
    }
    
    public func connect(toHost host: String, onPort port: UInt16) throws {
        try connect(toHost: host, onPort: port, withTimeout: 30.0)
    }
    
    public func connect(toHost host: String, onPort port: UInt16, withTimeout timeout: TimeInterval) throws {
        let scheme = enableSSL ? "wss" : "ws"
        guard let url = URL(string: "\(scheme)://\(host):\(port)\(uri)") else {
            throw CocoaMQTTError.invalidURL
        }
        
        socketURL = url
        configureWebSocket(url: url)
        webSocket?.connect()
    }
    
    private func configureWebSocket(url: URL) {
        var request = URLRequest(url: url)
        
        // Add custom headers
        for (key, value) in headers {
            request.addValue(value, forHTTPHeaderField: key)
        }
        
        // Add WebSocket protocol header for MQTT
        request.addValue("mqtt", forHTTPHeaderField: "Sec-WebSocket-Protocol")
        
        webSocket = WebSocket(request: request)
        webSocket?.delegate = self
        
        // SSL configuration is handled by the URL scheme (wss vs ws)
    }
    
    public func disconnect() {
        print("🔌 WebSocket disconnect() called")
        webSocket?.disconnect()
        
        // Explicitly notify delegate of disconnection
        let executeBlock = { [weak self] in
            guard let self = self else { return }
            print("🔌 WebSocket notifying delegate of manual disconnection")
            self.delegate?.socketDidDisconnect(self, withError: nil)
        }
        
        if let queue = delegateQueue {
            queue.async { executeBlock() }
        } else {
            executeBlock()
        }
        
        webSocket = nil
        
        // Clear buffer and pending reads
        bufferQueue.async { [weak self] in
            self?.readBuffer.removeAll()
            self?.pendingReads.removeAll()
        }
    }
    
    public func readData(toLength length: UInt, withTimeout timeout: TimeInterval, tag: Int) {
        bufferQueue.async { [weak self] in
            guard let self = self else { return }
            
            print("🔍 WebSocket readData requested: \(length) bytes with tag \(tag)")
            
            // Check if we have enough data in buffer
            if self.readBuffer.count >= length {
                // Extract the requested data
                let requestedData = self.readBuffer.prefix(Int(length))
                self.readBuffer.removeFirst(Int(length))
                
                print("🔍 WebSocket serving \(requestedData.count) bytes from buffer (tag \(tag)): \(requestedData.map { String(format: "%02X", $0) }.joined(separator: " "))")
                
                // Deliver the data on the delegate queue
                let executeBlock = {
                    self.delegate?.socket(self, didRead: Data(requestedData), withTag: tag)
                }
                
                if let queue = self.delegateQueue {
                    queue.async { executeBlock() }
                } else {
                    executeBlock()
                }
            } else {
                // Queue the read request for when more data arrives
                print("🔍 WebSocket queuing read request: \(length) bytes with tag \(tag) (buffer has \(self.readBuffer.count) bytes)")
                self.pendingReads.append((length: length, tag: tag))
            }
        }
    }
    
    public func write(_ data: Data, withTimeout timeout: TimeInterval, tag: Int) {
        webSocket?.write(data: data) { [weak self] in
            guard let self = self else { return }
            
            let executeBlock = {
                self.delegate?.socket(self, didWriteDataWithTag: tag)
            }
            
            if let queue = self.delegateQueue {
                queue.async {
                    executeBlock()
                }
            } else {
                executeBlock()
            }
        }
    }
    
    private func processPendingReads() {
        bufferQueue.async { [weak self] in
            guard let self = self else { return }
            
            var i = 0
            while i < self.pendingReads.count {
                let pendingRead = self.pendingReads[i]
                
                if self.readBuffer.count >= pendingRead.length {
                    // Extract the requested data
                    let requestedData = self.readBuffer.prefix(Int(pendingRead.length))
                    self.readBuffer.removeFirst(Int(pendingRead.length))
                    
                    print("🔍 WebSocket serving queued \(requestedData.count) bytes (tag \(pendingRead.tag)): \(requestedData.map { String(format: "%02X", $0) }.joined(separator: " "))")
                    
                    // Remove this read from pending
                    self.pendingReads.remove(at: i)
                    
                    // Deliver the data on the delegate queue
                    let executeBlock = {
                        self.delegate?.socket(self, didRead: Data(requestedData), withTag: pendingRead.tag)
                    }
                    
                    if let queue = self.delegateQueue {
                        queue.async { executeBlock() }
                    } else {
                        executeBlock()
                    }
                } else {
                    i += 1
                }
            }
        }
    }
}

extension CocoaMQTTWebSocket: WebSocketDelegate {
    public func didReceive(event: WebSocketEvent, client: WebSocketClient) {
        let executeBlock = { [weak self] in
            guard let self = self else { return }
            
            switch event {
            case .connected(let headers):
                print("🔌 WebSocket connected with headers: \(headers)")
                self.delegate?.socketConnected(self)
                
            case .disconnected(let reason, let code):
                print("🔌 WebSocket disconnected: \(reason) (code: \(code))")
                let error = NSError(domain: "CocoaMQTTWebSocket", code: Int(code), userInfo: [NSLocalizedDescriptionKey: reason])
                self.delegate?.socketDidDisconnect(self, withError: error)
                
            case .text(let text):
                print("🔌 WebSocket received text (unexpected for MQTT): \(text)")
                break
                
            case .binary(let data):
                print("🔌 WebSocket received binary data: \(data.count) bytes - \(data.map { String(format: "%02X", $0) }.joined(separator: " "))")
                
                // Add data to buffer and process pending reads
                self.bufferQueue.async {
                    self.readBuffer.append(data)
                    print("🔍 WebSocket buffer now has \(self.readBuffer.count) bytes")
                    self.processPendingReads()
                }
                
            case .error(let error):
                print("🔌 WebSocket error: \(error?.localizedDescription ?? "Unknown error")")
                self.delegate?.socketDidDisconnect(self, withError: error)
                
            case .cancelled:
                print("🔌 WebSocket cancelled")
                self.delegate?.socketDidDisconnect(self, withError: nil)
                
            case .ping(_):
                print("🔌 WebSocket ping received")
                break
                
            case .pong(_):
                print("🔌 WebSocket pong received")
                break
                
            case .viabilityChanged(let isViable):
                print("🔌 WebSocket viability changed: \(isViable)")
                break
                
            case .reconnectSuggested(let shouldReconnect):
                print("🔌 WebSocket reconnect suggested: \(shouldReconnect)")
                break
                
            case .peerClosed:
                print("🔌 WebSocket peer closed connection")
                self.delegate?.socketDidDisconnect(self, withError: nil)
                break
            }
        }
        
        if let queue = delegateQueue {
            queue.async {
                executeBlock()
            }
        } else {
            executeBlock()
        }
    }
}