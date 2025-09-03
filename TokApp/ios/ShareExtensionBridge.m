#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ShareExtensionBridge, NSObject)

RCT_EXTERN_METHOD(getSharedData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
