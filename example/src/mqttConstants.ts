import { MqttConfig } from '../../src/Mqtt';

export const mqttConfig: MqttConfig = {
  clientId: 'mqttx_d11_rn_mqtt',
  host: 'broker.emqx.io',
  port: 1883,
  options: {
    password: '',
    cleanSession: true,
    enableSslConfig: false,
    keepAlive: 60,
    autoReconnect: true,
    retryCount: 3,
  },
};

// WebSocket configuration example
export const mqttWebSocketConfig: MqttConfig = {
  clientId: 'mqttx_d11_rn_mqtt',
  host: '',
  port: 8084,
  options: {
    username: '',
    password: '',
    cleanSession: true,
    enableSslConfig: true, // Set to true for WSS (WebSocket Secure)
    keepAlive: 60,
    autoReconnect: true,
    retryCount: 3,
    webSocket: {
      useWebSocket: true,
      uri: '/mqtt',
      headers: {
        // Add custom headers if needed
        // 'Authorization': 'Bearer your-token-here',
        // 'X-Custom-Header': 'custom-value',
      },
    },
  },
};
