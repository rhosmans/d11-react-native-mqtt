package com.d11.rn.mqtt

import android.util.Log
import com.hivemq.client.mqtt.MqttClientState
import com.hivemq.client.mqtt.datatypes.MqttQos
import com.hivemq.client.mqtt.mqtt5.Mqtt5Client
import com.hivemq.client.mqtt.mqtt5.Mqtt5RxClient
import com.hivemq.client.mqtt.mqtt5.exceptions.Mqtt5ConnAckException
import com.hivemq.client.mqtt.mqtt5.exceptions.Mqtt5DisconnectException
import io.reactivex.Observer
import io.reactivex.disposables.Disposable

class MqttHelper(
  private val clientId: String,
  host: String,
  port: Int,
  enableSslConfig: Boolean,
  useWebSocket: Boolean = false,
  webSocketUri: String = "/mqtt",
  webSocketHeaders: Map<String, String> = emptyMap(),
  private val emitJsiEvent: (eventId: String, payload: HashMap<String, Any>) -> Unit
) {
  private lateinit var mqtt: Mqtt5RxClient
  private val subscriptionMap: HashMap<String, HashMap<String, Subscription>> = HashMap()
  private var isManuallyDisconnecting = false
  private var connectDisposable: Disposable? = null

  companion object {
    const val CLIENT_INITIALIZE_EVENT = "client_initialize"
    const val CONNECTED_EVENT = "connected"
    const val DISCONNECTED_EVENT = "disconnected"
    const val SUBSCRIBE_SUCCESS = "subscribe_success"
    const val SUBSCRIBE_FAILED = "subscribe_failed"
    const val SUBSCRIPTION_EVENT = "subscription_event"
    const val ERROR_EVENT = "mqtt_error"

    const val CONNECTED = "connected"
    const val CONNECTING = "connecting"
    const val DISCONNECTED = "disconnected"

    // Error Reason Codes
    const val DEFAULT_ERROR = -1
    const val CONNECTION_ERROR = -2
    const val DISCONNECTION_ERROR = -3
    const val SUBSCRIPTION_ERROR = -4
    const val UNSUBSCRIPTION_ERROR = -5
    const val INITIALIZATION_ERROR = -6
    const val RX_CHAIN_ERROR = -7
  }

  init {
    Log.d("MQTT init", "Initializing MQTT client - clientId: $clientId, host: $host, port: $port, enableSsl: $enableSslConfig, useWebSocket: $useWebSocket, webSocketUri: $webSocketUri, headers: $webSocketHeaders")
    try {
      val clientBuilder = Mqtt5Client.builder()
        .identifier(clientId)
        .addDisconnectedListener { disconnectedContext ->
          val connPayload = try {
            (disconnectedContext.cause as Mqtt5ConnAckException?)?.mqttMessage?.reasonCode?.code
          } catch (e: Exception) {
            null
          }

          val disconnectPayload = try {
            (disconnectedContext.cause as Mqtt5DisconnectException).mqttMessage.reasonCode.code
          } catch (e: Exception) {
            null
          }

          var errorMessage = ""
          val params = HashMap<String, Any>().apply {
            put("clientId", clientId)
            put("reasonCode", connPayload ?: disconnectPayload ?: DISCONNECTION_ERROR)
            errorMessage = try {
              disconnectedContext.cause.message ?: "Unknown error"
            } catch (e: Exception) {
              e.message.toString();
            }
            put("errorMessage", errorMessage)
          }
          emitJsiEvent(DISCONNECTED_EVENT, params)
        }
        .addConnectedListener {
          isManuallyDisconnecting = false // Reset flag on successful connection
          val params = HashMap<String, Any>().apply {
            put("clientId", clientId)
            put("reasonCode", 0)
          }
          emitJsiEvent(CONNECTED_EVENT, params)
        }
        .serverHost(host)
        .serverPort(port)

      // Configure transport (WebSocket or TCP)
      val client = if (useWebSocket) {
        Log.d("MQTT WebSocket", "Configuring WebSocket with URI: $webSocketUri")
        clientBuilder
          .webSocketConfig()
          .serverPath(webSocketUri)
          .applyWebSocketConfig()
      } else {
        Log.d("MQTT TCP", "Using TCP transport")
        clientBuilder
      }

      mqtt = if (enableSslConfig) {
        client
          .sslWithDefaultConfig()
          .buildRx()
      } else {
        client
          .buildRx()
      }

      if (this::mqtt.isInitialized) {
        val params = HashMap<String, Any>().apply {
          put("clientId", clientId)
          put("clientInit", true)
        }
        emitJsiEvent(CLIENT_INITIALIZE_EVENT, params)
      }
    } catch (e: Exception) {
      Log.e("MQTT init", "Initialization failed: ${e.message}")
      val params = HashMap<String, Any>().apply {
        put("clientId", clientId)
        put("clientInit", false)
        put("errorMessage", e.message.toString())
        put("errorType", "INITIALIZATION")
        put("reasonCode", INITIALIZATION_ERROR)
      }
      emitJsiEvent(ERROR_EVENT, params)
    }
  }

  fun connect(options: MqttConnectOptions) {
    Log.d("MQTT Connect", "Connect called - clientId: $clientId, username: ${options.username}, current state: ${mqtt.state}")
    
    // Dispose any existing connection attempt
    connectDisposable?.let {
      if (!it.isDisposed) {
        Log.d("MQTT Connect", "Disposing previous connection attempt")
        it.dispose()
      }
    }
    
    // Check if already connected or connecting
    if (mqtt.state == MqttClientState.CONNECTED) {
      Log.d("MQTT Connect", "Client already connected")
      val params = HashMap<String, Any>().apply {
        put("clientId", clientId)
        put("reasonCode", 0)
      }
      emitJsiEvent(CONNECTED_EVENT, params)
      return
    }
    
    if (mqtt.state == MqttClientState.CONNECTING) {
      Log.d("MQTT Connect", "Client already connecting, ignoring duplicate call")
      return
    }
    
    Log.d("MQTT Connect", "Starting connection attempt...")
    connectDisposable = mqtt.connectWith()
      .keepAlive(options.keepAlive)
      .cleanStart(options.cleanSession)
      .simpleAuth()
      .username(options.username)
      .password(options.password)
      .applySimpleAuth()
      .applyConnect()
      .doOnSuccess { ack ->
        Log.d("MQTT Connect", "Connection successful - reasonCode: ${ack.reasonCode}, reasonString: ${ack.reasonString}")
        connectDisposable = null
        for ((topic, eventIdMap) in subscriptionMap) {
          for ((eventId, subscription) in eventIdMap) {
            subscription.disposable.dispose()
            subscribeMqtt(eventId, topic, subscription.qos)
          }
        }
      }
      .doOnError { error ->
        Log.e("MQTT Connect", "Connection failed - error: ${error.message}, cause: ${error.cause}, errorClass: ${error.javaClass.simpleName}")
        connectDisposable = null
        val params = HashMap<String, Any>().apply {
          put("clientId", clientId)
          put("clientConnected", false)
          put("errorMessage", error.message.toString())
          put("errorCause", error.cause.toString())
          put("errorType", "CONNECTION")
          put("reasonCode", CONNECTION_ERROR)
        }
        emitJsiEvent(ERROR_EVENT, params)
      }
      .subscribe(
        {},
        { throwable ->
          Log.e("RxJava", "RxJava error in connection subscribe: ${throwable.message}, errorClass: ${throwable.javaClass.simpleName}")
          connectDisposable = null
        })

  }

  fun disconnectMqtt() {
    Log.d("MQTT Disconnect", "disconnect called, current state: " + mqtt.state)
    isManuallyDisconnecting = true
    
    // Dispose any pending connection attempt
    connectDisposable?.let {
      if (!it.isDisposed) {
        Log.d("MQTT Disconnect", "Disposing pending connection attempt")
        it.dispose()
      }
      connectDisposable = null
    }
    
    if (mqtt.state == MqttClientState.DISCONNECTED) {
      Log.d("MQTT Disconnect", "Client already disconnected")
      return
    }
    
    val disposable: Disposable = mqtt.disconnect()
      .doOnComplete {
        Log.d(
          "MQTT Disconnect",
          "doOnComplete"
        ) // TODO: Replace with LogWrapper when available on bridge
      }
      .doOnError { error ->
        Log.e(
          "MQTT Disconnect",
          "" + error.message
        ) // TODO: Replace with LogWrapper when available on bridge

        /**
         * Will be triggered when disconnection failed. Ideally this can happen when connection is already disconnected.
         */
        val params = HashMap<String, Any>().apply {
          put("clientId", clientId)
          put("clientDisconnected", false)
          put("errorMessage", error.message.toString())
          put("reasonCode", DISCONNECTION_ERROR)
        }
        emitJsiEvent(DISCONNECTED_EVENT, params)
      }
      .subscribe(
        {},
        { throwable ->
          // This is the error handler in the subscribe method.
          // It will be called if an error occurs in the observable chain.
          Log.e("RxJava", "Error occurred in subscribe: ${throwable.message}")
        })
  }

  fun subscribeMqtt(eventId: String, topic: String, qos: Int) {
    val disposable: Disposable = mqtt.subscribePublishesWith()
      .topicFilter(topic)
      .qos(MqttQos.fromCode(qos) ?: MqttQos.AT_MOST_ONCE)
      .applySubscribe()
      .doOnSingle { subAck ->
        Log.e("MQTT Subscribe", "" + subAck.reasonString)

        val params = HashMap<String, Any>().apply {
          put("eventId", eventId)
          put("message", subAck.reasonString.toString())
          put("topic", topic)
          put("qos", (MqttQos.fromCode(qos) ?: MqttQos.AT_MOST_ONCE).code)
        }
        emitJsiEvent(SUBSCRIBE_SUCCESS, params)
      }
      .doOnNext { publish ->
        val params = HashMap<String, Any>().apply {
          put("eventId", eventId)
          put("payload", String(publish.payloadAsBytes))
          put("topic", publish.topic.toString())
          put("qos", publish.qos.code)
        }
        emitJsiEvent(SUBSCRIPTION_EVENT, params)
      }
      .doOnError { error ->
        Log.e(
          "MQTT Subscribe",
          "" + error.message
        ) // TODO: Replace with LogWrapper when available on bridge
        
        // Don't emit subscription errors if we're manually disconnecting
        if (!isManuallyDisconnecting) {
          val params = HashMap<String, Any>().apply {
            put("eventId", eventId)
            put("clientSubscribed", false)
            put("errorMessage", error.message.toString())
            put("reasonCode", SUBSCRIPTION_ERROR)
          }
          emitJsiEvent(SUBSCRIBE_FAILED, params)
        }
      }
      .subscribe(
        {},
        { throwable ->
          // This is the error handler in the subscribe method.
          // It will be called if an error occurs in the observable chain.
          Log.e("RxJava", "Error occurred in subscribe: ${throwable.message}")
        })

    if (!subscriptionMap.containsKey(topic)) {
      subscriptionMap[topic] = HashMap()
    }
    subscriptionMap[topic]?.set(eventId, Subscription(disposable, qos))
  }

  fun unsubscribeMqtt(eventId: String, topic: String) {
    val allSubscriptions = subscriptionMap[topic]
    if (allSubscriptions == null) {
      Log.e("MQTT Unsubscribe", "unable to unsubscribe topic: $topic")
      return
    }
    allSubscriptions[eventId]?.disposable?.dispose()
    if (allSubscriptions.size > 1) {
      allSubscriptions.remove(eventId)
    } else {
      val disposable: Disposable = mqtt.unsubscribeWith()
        .addTopicFilter(topic)
        .applyUnsubscribe()
        .doOnSuccess { unsubAck ->
          // TODO: Replace with LogWrapper when available on bridge
          Log.e("MQTT Unsubscribe", "" + unsubAck.reasonString)
        }
        .doOnError { error ->
          // TODO: Replace with LogWrapper when available on bridge
          Log.e("MQTT Unsubscribe", "" + error.message)
          val params = HashMap<String, Any>().apply {
            put("clientId", clientId)
            put("clientUnsubscribed", false)
            put("errorMessage", error.message.toString())
            put("errorType", "UNSUBSCRIPTION")
            put("topic", topic)
            put("reasonCode", UNSUBSCRIPTION_ERROR)
          }
          emitJsiEvent(ERROR_EVENT, params)
        }
        .subscribe(
          {},
          { throwable ->
            // This is the error handler in the subscribe method.
            // It will be called if an error occurs in the observable chain.
            Log.e("RxJava", "Error occurred in subscribe: ${throwable.message}")
          })
      subscriptionMap.remove(topic)
    }
  }

  fun getConnectionStatusMqtt(): String {
    return when (mqtt.state) {
      MqttClientState.CONNECTED -> {
        CONNECTED
      }

      MqttClientState.DISCONNECTED -> {
        DISCONNECTED
      }

      MqttClientState.CONNECTING -> {
        CONNECTING
      }

      MqttClientState.DISCONNECTED_RECONNECT -> {
        DISCONNECTED
      }

      MqttClientState.CONNECTING_RECONNECT -> {
        CONNECTING
      }
    }
  }
}

data class Subscription(
  val disposable: Disposable,
  val qos: Int
)


