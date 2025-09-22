//
//  MqttEventEmitter.m
//  d11-mqtt
//
//  Created by Vibhor Verma on 07/11/23.
//

#import "MqttEventEmitter.h"
#import <React/RCTBridge+Private.h>


@implementation MqttEventEmitter

- (void)sendEvent:(NSString * _Nonnull)eventName param:(NSDictionary<NSString *,id> *_Nullable)params {
    NSLog(@"📡 OBJC: MqttEventEmitter.sendEvent called with event: %@ params: %@", eventName, params);
    RCTBridge* bridge = [RCTBridge currentBridge];
    NSLog(@"📡 OBJC: Got bridge: %@", bridge);
    id mqttModule = [bridge moduleForClass:[MqttModule class]];
    NSLog(@"📡 OBJC: Got MqttModule: %@", mqttModule);
    [mqttModule sendEventToJs:eventName param:params];
    NSLog(@"📡 OBJC: sendEventToJs completed for event: %@", eventName);
}

@end
