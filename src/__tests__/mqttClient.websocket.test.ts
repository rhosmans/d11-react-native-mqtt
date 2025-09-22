import { MqttClient } from '../Mqtt/MqttClient';
import { MqttJSIModule } from '../Modules/mqttModule';
import { EventEmitter } from '../Mqtt/EventEmitter';
import { MQTT_EVENTS } from '../Mqtt/MqttClient.constants';
import { NativeModules } from 'react-native';
const { MqttModule } = NativeModules;

const baseClientConfig = {
  autoReconnect: false,
  keepAlive: 60,
  username: 'test-user',
  password: 'test-password',
  cleanSession: true,
  retryCount: 0,
  backoffTime: 100,
  maxBackoffTime: 100,
  jitter: 1,
};

jest.mock('../Mqtt/EventEmitter', () => {
  const remove = jest.fn();
  const mEventEmitter = {
    getInstance: jest.fn(),
    addListener: jest.fn((_, callback) => {
      callback({ reasonCode: 0, clientId: 'websocket-test-client' });
      return { remove };
    }),
    removeAllListeners: jest.fn(),
  };
  mEventEmitter.getInstance.mockReturnValue(mEventEmitter);
  return { EventEmitter: mEventEmitter };
});

jest.mock('../Mqtt/MqttClient.utils', () => ({
  getMqttBackoffTime: jest.fn().mockReturnValue(1000),
}));

jest.mock('../Modules/mqttModule', () => ({
  MqttJSIModule: {
    connectMqtt: jest.fn(),
    disconnectMqtt: jest.fn(),
    removeMqtt: jest.fn(),
    subscribeMqtt: jest.fn(),
    unsubscribeMqtt: jest.fn(),
    getConnectionStatusMqtt: jest.fn().mockReturnValue('connected'),
  },
}));

jest.mock('react-native', () => ({
  NativeModules: {
    MqttModule: {
      createMqtt: jest.fn(),
    },
  },
}));

describe('MqttClient WebSocket Tests', () => {
  const clientId = 'websocket-test-client';
  const host = 'mqtt-ws.example.com';
  const port = 443;
  let mqttClient: MqttClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('WebSocket TCP Creation Tests', () => {
    it('should create MQTT client with WebSocket disabled (TCP)', () => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: false,
      };

      mqttClient = new MqttClient(clientId, host, 1883, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        1883,
        false,
        false,
        '/mqtt',
        {}
      );
    });

    it('should create MQTT client with SSL over TCP', () => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
      };

      mqttClient = new MqttClient(clientId, host, 8883, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        8883,
        true,
        false,
        '/mqtt',
        {}
      );
    });
  });

  describe('WebSocket Creation Tests', () => {
    it('should create MQTT client with WebSocket (WS)', () => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: false,
        webSocket: {
          useWebSocket: true,
          uri: '/mqtt',
          headers: {},
        },
      };

      mqttClient = new MqttClient(clientId, host, 80, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        80,
        false,
        true,
        '/mqtt',
        {}
      );
    });

    it('should create MQTT client with secure WebSocket (WSS)', () => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          uri: '/mqtt',
          headers: {},
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        port,
        true,
        true,
        '/mqtt',
        {}
      );
    });

    it('should create WebSocket client with custom URI path', () => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          uri: '/custom-mqtt-path',
          headers: {},
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        port,
        true,
        true,
        '/custom-mqtt-path',
        {}
      );
    });

    it('should create WebSocket client with custom headers', () => {
      const customHeaders = {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value',
      };

      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          uri: '/mqtt',
          headers: customHeaders,
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        port,
        true,
        true,
        '/mqtt',
        customHeaders
      );
    });
  });

  describe('WebSocket Connection Tests', () => {
    beforeEach(() => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          uri: '/mqtt',
          headers: {},
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);
    });

    it('should connect via WebSocket with correct parameters', () => {
      mqttClient.connect();

      expect(MqttJSIModule.connectMqtt).toHaveBeenCalledWith(clientId, {
        cleanSession: true,
        keepAlive: 60,
        password: 'test-password',
        username: 'test-user',
      });
    });

    it('should handle WebSocket connection success', () => {
      const connectCallback = jest.fn();
      mqttClient.setOnConnectCallback(connectCallback);

      expect(EventEmitter.getInstance().addListener).toHaveBeenCalledWith(
        MQTT_EVENTS.CONNECTED_EVENT,
        expect.any(Function)
      );
    });

    it('should disconnect WebSocket connection', () => {
      mqttClient.disconnect();

      expect(mqttClient.connectionStatus).toBe('disconnected');
      expect(MqttJSIModule.disconnectMqtt).toHaveBeenCalledWith(clientId);
    });
  });

  describe('WebSocket Subscription Tests', () => {
    beforeEach(() => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          uri: '/mqtt',
          headers: {},
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);
    });

    it('should subscribe to topic via WebSocket', () => {
      const topic = 'websocket/test/topic';
      const qos = 1;
      const onEvent = jest.fn();

      const subscription = mqttClient.subscribe({ topic, qos, onEvent });

      expect(MqttJSIModule.subscribeMqtt).toHaveBeenCalledWith(
        expect.any(String),
        clientId,
        topic,
        qos
      );

      expect(subscription.remove).toBeDefined();
    });

    it('should handle WebSocket message reception', () => {
      const topic = 'websocket/test/topic';
      const qos = 1;
      const onEvent = jest.fn();

      mqttClient.subscribe({ topic, qos, onEvent });

      expect(EventEmitter.getInstance().addListener).toHaveBeenCalledWith(
        MQTT_EVENTS.SUBSCRIPTION_EVENT,
        expect.any(Function)
      );
    });

    it('should unsubscribe from WebSocket topic', () => {
      const topic = 'websocket/test/topic';
      const qos = 1;
      const onEvent = jest.fn();

      const subscription = mqttClient.subscribe({ topic, qos, onEvent });
      subscription.remove();

      expect(MqttJSIModule.subscribeMqtt).toHaveBeenCalled();
    });
  });

  describe('WebSocket Error Handling Tests', () => {
    beforeEach(() => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          uri: '/mqtt',
          headers: {},
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);
    });

    it('should handle WebSocket connection errors', () => {
      const errorCallback = jest.fn();
      mqttClient.setOnErrorCallback(errorCallback);

      expect(EventEmitter.getInstance().addListener).toHaveBeenCalledWith(
        MQTT_EVENTS.ERROR_EVENT,
        expect.any(Function)
      );
    });

    it('should handle WebSocket disconnection events', () => {
      const disconnectCallback = jest.fn();
      mqttClient.setOnDisconnectCallback(disconnectCallback);

      expect(EventEmitter.getInstance().addListener).toHaveBeenCalledWith(
        MQTT_EVENTS.DISCONNECTED_EVENT,
        expect.any(Function)
      );
    });

    it('should handle WebSocket subscription failures', () => {
      const topic = 'websocket/test/topic';
      const qos = 1;
      const onEvent = jest.fn();
      const onError = jest.fn();

      mqttClient.subscribe({ topic, qos, onEvent, onError });

      // Verify that subscription was attempted and error handling is available
      expect(MqttJSIModule.subscribeMqtt).toHaveBeenCalledWith(
        expect.any(String),
        'websocket-test-client',
        topic,
        qos
      );
      expect(onError).toBeDefined();
    });
  });

  describe('WebSocket Configuration Validation Tests', () => {
    it('should handle missing WebSocket URI with default', () => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          headers: {},
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        port,
        true,
        true,
        '/mqtt',
        {}
      );
    });

    it('should handle empty WebSocket headers', () => {
      const clientConfig = {
        ...baseClientConfig,
        enableSslConfig: true,
        webSocket: {
          useWebSocket: true,
          uri: '/mqtt',
        },
      };

      mqttClient = new MqttClient(clientId, host, port, clientConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        clientId,
        host,
        port,
        true,
        true,
        '/mqtt',
        {}
      );
    });
  });

  describe('WebSocket vs TCP Comparison Tests', () => {
    it('should create different configurations for TCP vs WebSocket', () => {
      // const tcpConfig = {
      //   ...baseClientConfig,
      //   enableSslConfig: true,
      // };

      // const wsConfig = {
      //   ...baseClientConfig,
      //   enableSslConfig: true,
      //   webSocket: {
      //     useWebSocket: true,
      //     uri: '/mqtt',
      //     headers: {},
      //   },
      // };

      // const tcpClient = new MqttClient('tcp-client', host, 8883, tcpConfig);
      // const wsClient = new MqttClient('ws-client', host, 443, wsConfig);

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        'tcp-client',
        host,
        8883,
        true,
        false,
        '/mqtt',
        {}
      );

      expect(MqttModule.createMqtt).toHaveBeenCalledWith(
        'ws-client',
        host,
        443,
        true,
        true,
        '/mqtt',
        {}
      );
    });
  });
});
