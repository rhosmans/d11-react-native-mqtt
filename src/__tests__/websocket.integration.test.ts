import { MqttClient } from '../Mqtt/MqttClient';
import { CONNECTION_STATE } from '../Mqtt/MqttClient.constants';

const REAL_WEBSOCKET_CONFIG = {
  autoReconnect: false,
  keepAlive: 60,
  username: 'test-user',
  password: 'test-password',
  cleanSession: true,
  retryCount: 0,
  backoffTime: 100,
  maxBackoffTime: 100,
  jitter: 1,
  enableSslConfig: true,
  useWebSocket: true,
  webSocketUri: '/mqtt',
  webSocketHeaders: {},
};

const REAL_TCP_CONFIG = {
  autoReconnect: false,
  keepAlive: 60,
  username: 'test-user',
  password: 'test-password',
  cleanSession: true,
  retryCount: 0,
  backoffTime: 100,
  maxBackoffTime: 100,
  jitter: 1,
  enableSslConfig: true,
  useWebSocket: false,
};

jest.setTimeout(30000);

describe('WebSocket Integration Tests', () => {
  let wsClient: MqttClient;
  let tcpClient: MqttClient;

  afterEach(() => {
    if (wsClient) {
      wsClient.disconnect();
      wsClient.remove();
    }
    if (tcpClient) {
      tcpClient.disconnect();
      tcpClient.remove();
    }
  });

  describe('Client Creation Integration', () => {
    it('should create WebSocket client with proper configuration', () => {
      wsClient = new MqttClient(
        'integration-ws-client',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );

      expect(wsClient).toBeDefined();
      expect(wsClient.options.useWebSocket).toBe(true);
      expect(wsClient.options.webSocketUri).toBe('/mqtt');
      expect(wsClient.options.enableSslConfig).toBe(true);
    });

    it('should create TCP client with proper configuration', () => {
      tcpClient = new MqttClient(
        'integration-tcp-client',
        'mqtt.example.com',
        8883,
        REAL_TCP_CONFIG
      );

      expect(tcpClient).toBeDefined();
      expect(tcpClient.options.useWebSocket).toBe(false);
      expect(tcpClient.options.enableSslConfig).toBe(true);
    });
  });

  describe('Connection State Management', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'connection-test-client',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );
    });

    it('should start in disconnected state', () => {
      expect(wsClient.getConnectionStatus()).toBe(
        CONNECTION_STATE.DISCONNECTED
      );
    });

    it('should transition to connecting state when connect is called', () => {
      wsClient.connect();
      expect(wsClient.connectionStatus).toBe(CONNECTION_STATE.CONNECTING);
    });

    it('should be able to disconnect from any state', () => {
      wsClient.connect();
      wsClient.disconnect();
      expect(wsClient.connectionStatus).toBe(CONNECTION_STATE.DISCONNECTED);
    });
  });

  describe('Event Listener Management', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'event-test-client',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );
    });

    it('should register connection event listeners', () => {
      const connectCallback = jest.fn();
      const disconnectCallback = jest.fn();
      const errorCallback = jest.fn();

      const connectListener = wsClient.setOnConnectCallback(connectCallback);
      const disconnectListener =
        wsClient.setOnDisconnectCallback(disconnectCallback);
      const errorListener = wsClient.setOnErrorCallback(errorCallback);

      expect(connectListener.remove).toBeDefined();
      expect(disconnectListener.remove).toBeDefined();
      expect(errorListener.remove).toBeDefined();
    });

    it('should handle multiple event listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const listener1 = wsClient.setOnConnectCallback(callback1);
      const listener2 = wsClient.setOnConnectCallback(callback2);

      expect(listener1.remove).toBeDefined();
      expect(listener2.remove).toBeDefined();
    });
  });

  describe('Subscription Management Integration', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'subscription-test-client',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );
    });

    it('should handle multiple subscriptions', () => {
      const subscription1 = wsClient.subscribe({
        topic: 'test/topic/1',
        qos: 0,
        onEvent: jest.fn(),
      });

      const subscription2 = wsClient.subscribe({
        topic: 'test/topic/2',
        qos: 1,
        onEvent: jest.fn(),
      });

      expect(subscription1.remove).toBeDefined();
      expect(subscription2.remove).toBeDefined();
    });

    it('should allow subscription removal', () => {
      const subscription = wsClient.subscribe({
        topic: 'test/removable/topic',
        qos: 0,
        onEvent: jest.fn(),
      });

      expect(() => subscription.remove()).not.toThrow();
    });

    it('should handle wildcard subscriptions', () => {
      const wildcardSubscription = wsClient.subscribe({
        topic: 'test/+/wildcard',
        qos: 1,
        onEvent: jest.fn(),
      });

      const multiWildcardSubscription = wsClient.subscribe({
        topic: 'test/#',
        qos: 2,
        onEvent: jest.fn(),
      });

      expect(wildcardSubscription.remove).toBeDefined();
      expect(multiWildcardSubscription.remove).toBeDefined();
    });
  });

  describe('WebSocket vs TCP Feature Parity', () => {
    it('should provide same API for both WebSocket and TCP clients', () => {
      wsClient = new MqttClient(
        'ws-parity-test',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );

      tcpClient = new MqttClient(
        'tcp-parity-test',
        'mqtt.example.com',
        8883,
        REAL_TCP_CONFIG
      );

      const wsApiMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(wsClient)
      );
      const tcpApiMethods = Object.getOwnPropertyNames(
        Object.getPrototypeOf(tcpClient)
      );

      expect(wsApiMethods).toEqual(tcpApiMethods);
    });

    it('should handle same subscription patterns for both protocols', () => {
      wsClient = new MqttClient(
        'ws-sub-test',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );

      tcpClient = new MqttClient(
        'tcp-sub-test',
        'mqtt.example.com',
        8883,
        REAL_TCP_CONFIG
      );

      const wsSubscription = wsClient.subscribe({
        topic: 'parity/test',
        qos: 1,
        onEvent: jest.fn(),
      });

      const tcpSubscription = tcpClient.subscribe({
        topic: 'parity/test',
        qos: 1,
        onEvent: jest.fn(),
      });

      expect(typeof wsSubscription.remove).toBe('function');
      expect(typeof tcpSubscription.remove).toBe('function');
    });
  });

  describe('Configuration Validation Integration', () => {
    it('should validate WebSocket-specific configuration', () => {
      const invalidConfig = {
        ...REAL_WEBSOCKET_CONFIG,
        webSocketUri: '',
      };

      wsClient = new MqttClient(
        'config-test-client',
        'mqtt-ws.example.com',
        443,
        invalidConfig
      );

      expect(wsClient.options.webSocketUri).toBe('/mqtt');
    });

    it('should handle missing WebSocket headers gracefully', () => {
      const configWithoutHeaders = {
        ...REAL_WEBSOCKET_CONFIG,
        webSocketHeaders: undefined,
      };

      wsClient = new MqttClient(
        'headers-test-client',
        'mqtt-ws.example.com',
        443,
        configWithoutHeaders
      );

      expect(wsClient.options.webSocketHeaders).toEqual({});
    });
  });

  describe('Reconnection Integration Tests', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'reconnect-test-client',
        'mqtt-ws.example.com',
        443,
        {
          ...REAL_WEBSOCKET_CONFIG,
          autoReconnect: true,
          retryCount: 3,
        }
      );
    });

    it('should support reconnection configuration for WebSocket', () => {
      expect(wsClient.options.autoReconnect).toBe(true);
      expect(wsClient.options.retryCount).toBe(3);
    });

    it('should allow setting reconnection interceptor', () => {
      const reconnectInterceptor = jest.fn();

      expect(() => {
        wsClient.setOnReconnectIntercepter(reconnectInterceptor);
      }).not.toThrow();
    });
  });

  describe('Resource Management Integration', () => {
    it('should properly clean up WebSocket resources', () => {
      wsClient = new MqttClient(
        'cleanup-test-client',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );

      const subscription = wsClient.subscribe({
        topic: 'cleanup/test',
        qos: 0,
        onEvent: jest.fn(),
      });

      expect(() => {
        subscription.remove();
        wsClient.disconnect();
        wsClient.remove();
      }).not.toThrow();
    });

    it('should handle concurrent operations safely', () => {
      wsClient = new MqttClient(
        'concurrent-test-client',
        'mqtt-ws.example.com',
        443,
        REAL_WEBSOCKET_CONFIG
      );

      expect(() => {
        wsClient.connect();
        wsClient.subscribe({
          topic: 'test/concurrent',
          qos: 0,
          onEvent: jest.fn(),
        });
        wsClient.disconnect();
      }).not.toThrow();
    });
  });
});
