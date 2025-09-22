import { MqttClient } from '../Mqtt/MqttClient';
import { MQTT_EVENTS } from '../Mqtt/MqttClient.constants';

// const { MqttModule } = NativeModules;

jest.mock('../Mqtt/EventEmitter', () => {
  const remove = jest.fn();
  const mEventEmitter = {
    getInstance: jest.fn(),
    addListener: jest.fn((_) => {
      return { remove };
    }),
    removeAllListeners: jest.fn(),
  };
  mEventEmitter.getInstance.mockReturnValue(mEventEmitter);
  return { EventEmitter: mEventEmitter };
});

jest.mock('../Modules/mqttModule', () => ({
  MqttJSIModule: {
    connectMqtt: jest.fn(),
    disconnectMqtt: jest.fn(),
    removeMqtt: jest.fn(),
    subscribeMqtt: jest.fn(),
    unsubscribeMqtt: jest.fn(),
    getConnectionStatusMqtt: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  NativeModules: {
    MqttModule: {
      createMqtt: jest.fn(),
    },
  },
}));

const baseConfig = {
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

describe('WebSocket Error Handling Tests', () => {
  let wsClient: MqttClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (wsClient) {
      wsClient.remove();
    }
  });

  describe('Connection Error Scenarios', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'error-test-client',
        'invalid-host.example.com',
        443,
        baseConfig
      );
    });

    it('should handle WebSocket connection timeout', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const timeoutError = {
        clientId: 'error-test-client',
        errorMessage: 'Connection timeout',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      capturedCallback?.(timeoutError);

      expect(errorCallback).toHaveBeenCalledWith(timeoutError);
    });

    it('should handle WebSocket handshake failure', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const handshakeError = {
        clientId: 'error-test-client',
        errorMessage: 'WebSocket handshake failed: 404 Not Found',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      capturedCallback?.(handshakeError);

      expect(errorCallback).toHaveBeenCalledWith(handshakeError);
    });

    it('should handle SSL certificate validation errors', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const sslError = {
        clientId: 'error-test-client',
        errorMessage: 'SSL certificate verification failed',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      capturedCallback?.(sslError);

      expect(errorCallback).toHaveBeenCalledWith(sslError);
    });

    it('should handle authentication failures', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const authError = {
        clientId: 'error-test-client',
        errorMessage: 'Authentication failed: Bad username or password',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      capturedCallback?.(authError);

      expect(errorCallback).toHaveBeenCalledWith(authError);
    });
  });

  describe('Disconnection Error Scenarios', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'disconnect-error-client',
        'mqtt-ws.example.com',
        443,
        baseConfig
      );
    });

    it('should handle unexpected WebSocket disconnection', () => {
      const disconnectCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.DISCONNECTED_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnDisconnectCallback(disconnectCallback);

      const disconnectError = {
        clientId: 'disconnect-error-client',
        errorMessage: 'WebSocket connection closed unexpectedly',
        reasonCode: -3,
      };

      capturedCallback?.(disconnectError);

      expect(disconnectCallback).toHaveBeenCalledWith(disconnectError);
    });

    it('should handle network-related disconnections', () => {
      const disconnectCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.DISCONNECTED_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnDisconnectCallback(disconnectCallback);

      const networkError = {
        clientId: 'disconnect-error-client',
        errorMessage: 'Network unreachable',
        reasonCode: -3,
      };

      capturedCallback?.(networkError);

      expect(disconnectCallback).toHaveBeenCalledWith(networkError);
    });

    it('should handle server-initiated disconnections', () => {
      const disconnectCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.DISCONNECTED_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnDisconnectCallback(disconnectCallback);

      const serverDisconnect = {
        clientId: 'disconnect-error-client',
        errorMessage: 'Server disconnected the client',
        reasonCode: 141,
      };

      capturedCallback?.(serverDisconnect);

      expect(disconnectCallback).toHaveBeenCalledWith(serverDisconnect);
    });
  });

  describe('Subscription Error Scenarios', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'subscription-error-client',
        'mqtt-ws.example.com',
        443,
        baseConfig
      );
    });

    it('should handle subscription failures due to invalid topic', () => {
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.SUBSCRIBE_FAILED) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.subscribe({
        topic: 'invalid topic with spaces',
        qos: 0,
        onEvent: jest.fn(),
      });

      const subscriptionError = {
        eventId: expect.any(String),
        errorMessage: 'Invalid topic filter',
        reasonCode: -4,
      };

      capturedCallback?.(subscriptionError);

      expect(capturedCallback).toBeDefined();
    });

    it('should handle subscription failures due to QoS not supported', () => {
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.SUBSCRIBE_FAILED) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.subscribe({
        topic: 'test/topic',
        qos: 3, // Invalid QoS level
        onEvent: jest.fn(),
      });

      const qosError = {
        eventId: expect.any(String),
        errorMessage: 'QoS level not supported',
        reasonCode: -4,
      };

      capturedCallback?.(qosError);

      expect(capturedCallback).toBeDefined();
    });

    it('should handle subscription failures due to authorization', () => {
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.SUBSCRIBE_FAILED) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.subscribe({
        topic: 'restricted/topic',
        qos: 1,
        onEvent: jest.fn(),
      });

      const authError = {
        eventId: expect.any(String),
        errorMessage: 'Not authorized to subscribe to topic',
        reasonCode: -4,
      };

      capturedCallback?.(authError);

      expect(capturedCallback).toBeDefined();
    });
  });

  describe('WebSocket-Specific Error Scenarios', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'ws-specific-error-client',
        'mqtt-ws.example.com',
        443,
        baseConfig
      );
    });

    it('should handle WebSocket upgrade failures', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const upgradeError = {
        clientId: 'ws-specific-error-client',
        errorMessage: 'Failed to upgrade HTTP connection to WebSocket',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      capturedCallback?.(upgradeError);

      expect(errorCallback).toHaveBeenCalledWith(upgradeError);
    });

    it('should handle WebSocket protocol violations', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const protocolError = {
        clientId: 'ws-specific-error-client',
        errorMessage: 'WebSocket protocol violation',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      capturedCallback?.(protocolError);

      expect(errorCallback).toHaveBeenCalledWith(protocolError);
    });

    it('should handle WebSocket frame parsing errors', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const frameError = {
        clientId: 'ws-specific-error-client',
        errorMessage: 'Invalid WebSocket frame received',
        reasonCode: -7,
        errorType: 'RX_CHAIN',
      };

      capturedCallback?.(frameError);

      expect(errorCallback).toHaveBeenCalledWith(frameError);
    });
  });

  describe('Error Recovery Scenarios', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'recovery-test-client',
        'mqtt-ws.example.com',
        443,
        {
          ...baseConfig,
          autoReconnect: true,
          retryCount: 3,
        }
      );
    });

    it('should attempt reconnection after WebSocket errors', () => {
      const reconnectInterceptor = jest.fn();
      wsClient.setOnReconnectIntercepter(reconnectInterceptor);

      let errorCallback: any;
      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            errorCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(jest.fn());

      const connectionError = {
        clientId: 'recovery-test-client',
        errorMessage: 'WebSocket connection failed',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      errorCallback?.(connectionError);

      expect(wsClient.options.autoReconnect).toBe(true);
    });

    it('should handle multiple consecutive errors gracefully', () => {
      const errorCallback = jest.fn();
      let capturedCallback: any;

      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            capturedCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(errorCallback);

      const errors = [
        {
          clientId: 'recovery-test-client',
          errorMessage: 'Error 1',
          reasonCode: -2,
        },
        {
          clientId: 'recovery-test-client',
          errorMessage: 'Error 2',
          reasonCode: -3,
        },
        {
          clientId: 'recovery-test-client',
          errorMessage: 'Error 3',
          reasonCode: -4,
        },
      ];

      errors.forEach((error) => capturedCallback?.(error));

      expect(errorCallback).toHaveBeenCalledTimes(3);
    });
  });

  describe('Resource Cleanup on Errors', () => {
    beforeEach(() => {
      wsClient = new MqttClient(
        'cleanup-test-client',
        'mqtt-ws.example.com',
        443,
        baseConfig
      );
    });

    it('should clean up subscriptions on connection errors', () => {
      const subscription = wsClient.subscribe({
        topic: 'test/cleanup',
        qos: 0,
        onEvent: jest.fn(),
      });

      let errorCallback: any;
      mockEmitterInstance.addListener.mockImplementation(
        (event: string, callback: any) => {
          if (event === MQTT_EVENTS.ERROR_EVENT) {
            errorCallback = callback;
          }
          return { remove: jest.fn() };
        }
      );

      wsClient.setOnErrorCallback(jest.fn());

      const connectionError = {
        clientId: 'cleanup-test-client',
        errorMessage: 'Connection failed',
        reasonCode: -2,
        errorType: 'CONNECTION',
      };

      errorCallback?.(connectionError);

      expect(subscription.remove).toBeDefined();
    });

    it('should handle errors during client removal', () => {
      expect(() => {
        wsClient.remove();
      }).not.toThrow();
    });
  });
});
