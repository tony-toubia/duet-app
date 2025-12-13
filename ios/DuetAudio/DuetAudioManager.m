#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(DuetAudioManager, RCTEventEmitter)

RCT_EXTERN_METHOD(setupAudioSession:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(startAudioEngine:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopAudioEngine:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(playAudio:(NSString *)base64Audio
                  sampleRate:(double)sampleRate
                  channels:(int)channels
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(setMuted:(BOOL)muted)
RCT_EXTERN_METHOD(setDeafened:(BOOL)deafened)
RCT_EXTERN_METHOD(setVadThreshold:(float)threshold)

@end
