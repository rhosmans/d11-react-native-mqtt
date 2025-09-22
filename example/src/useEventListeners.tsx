import * as React from 'react';
import { MqttClient } from '../../src/Mqtt/MqttClient';

export const useEventListeners = (
  mqttClient: MqttClient | undefined,
  setConnectionStatus: (status: string) => void
) => {
  React.useEffect(() => {
    console.log(
      '🔧 Setting up event listeners for client:',
      mqttClient?.clientId
    );

    // Add raw event listeners to catch any events from native
    const eventEmitter = mqttClient?.eventEmitter;
    const rawConnectedListener = eventEmitter?.addListener(
      'connected',
      (data) => {
        console.log('🎯 Raw connected event received:', data);
      }
    );
    const rawDisconnectedListener = eventEmitter?.addListener(
      'disconnected',
      (data) => {
        console.log('🎯 Raw disconnected event received:', data);
      }
    );
    const rawErrorListener = eventEmitter?.addListener('mqtt_error', (data) => {
      console.log('🎯 Raw error event received:', data);
    });

    const connectionListener = mqttClient?.setOnConnectCallback((ack) => {
      console.log('✅ JS: MQTT Client Connection Success Event Received!', ack);
      setConnectionStatus('connected');
    });

    const onConnectFailureListener = mqttClient?.setOnConnectFailureCallback(
      (ack) => {
        console.log('::MQTT Client Connection Failure', ack);
        setConnectionStatus('connection_failed');
      }
    );

    const onErrorFailureListener = mqttClient?.setOnErrorCallback((ack) => {
      console.log('::MQTT Client Error', ack);
      setConnectionStatus('error');
    });

    const onDisconnectFailureListener = mqttClient?.setOnDisconnectCallback(
      (ack) => {
        console.log('🔴 JS: MQTT Client Disconnected Event Received!', ack);
        setConnectionStatus('disconnected');
      }
    );

    return () => {
      rawConnectedListener?.remove();
      rawDisconnectedListener?.remove();
      rawErrorListener?.remove();
      connectionListener?.remove();
      onConnectFailureListener?.remove();
      onErrorFailureListener?.remove();
      onDisconnectFailureListener?.remove();
    };
  }, [mqttClient, setConnectionStatus]);
};
