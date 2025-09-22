import * as React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { RoundButton } from './Button';
import { mqttConfig } from './mqttConstants';
import { useEventListeners } from './useEventListeners';
import { MqttClient } from '../../src/Mqtt/MqttClient';
import { initializeMqttClient } from './createMqtt';
import { subscriptionConfig } from './mqttUtils';

export default function App() {
  const [mqttClient, setClient] = React.useState<MqttClient | undefined>(
    undefined
  );
  const [connectionStatus, setConnectionStatus] =
    React.useState<string>('disconnected');

  useEventListeners(mqttClient, setConnectionStatus);

  React.useEffect(() => {
    initializeMqttClient(mqttConfig).then((client) => {
      if (client) {
        setClient(client);
      }
    });
  }, []);

  const connectMqtt = React.useCallback(() => {
    if (mqttClient) {
      console.log('::MQTT Attempting to connect...');
      setConnectionStatus('connecting');
      mqttClient.connect();
    }
  }, [mqttClient]);

  const subscribeMqtt = React.useCallback(
    () => (mqttClient ? mqttClient.subscribe(subscriptionConfig) : null),
    [mqttClient]
  );

  const disconnectMqtt = React.useCallback(() => {
    if (mqttClient) {
      console.log('::MQTT Attempting to disconnect...');
      setConnectionStatus('disconnecting');
      mqttClient.disconnect();
    }
  }, [mqttClient]);

  const removeMqtt = React.useCallback(() => {
    if (mqttClient) {
      mqttClient.remove();
      setClient(undefined);
    }
  }, [mqttClient]);

  const getConnectionStatus = React.useCallback(() => {
    const status = mqttClient ? mqttClient.getConnectionStatus() : 'no client';
    console.log(`::MQTT connectionStatus:${status}`);
    setConnectionStatus(status);
  }, [mqttClient]);

  return (
    <View style={styles.container}>
      <Text style={styles.statusText}>
        Connection Status: {connectionStatus}
      </Text>
      <RoundButton
        onPress={connectMqtt}
        backgroundColor={'#118a7e'}
        buttonText="Connect Mqtt"
        disabled={!mqttClient}
      />
      <RoundButton
        onPress={getConnectionStatus}
        backgroundColor={'#1f6f78'}
        buttonText="Connection Status"
        disabled={!mqttClient}
      />
      <RoundButton
        onPress={subscribeMqtt}
        backgroundColor={'#7fa99b'}
        buttonText="Subscribe Mqtt"
        disabled={!mqttClient}
      />
      <RoundButton
        onPress={disconnectMqtt}
        backgroundColor={'#ff5959'}
        buttonText="Disconnect Mqtt"
        disabled={!mqttClient}
      />
      <RoundButton
        onPress={removeMqtt}
        backgroundColor={'red'}
        buttonText="Remove Mqtt"
        disabled={!mqttClient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D3D3D3',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 250,
    textAlign: 'center',
  },
});
