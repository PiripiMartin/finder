import Foundation
import React

@objc(SharedUserDefaults)
class SharedUserDefaults: NSObject {
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  @objc
  func setSessionToken(_ token: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    if let userDefaults = UserDefaults(suiteName: "group.com.piripimartin.dew") {
      userDefaults.set(token, forKey: "sessionToken")
      userDefaults.synchronize()
      resolve(true)
    } else {
      reject("ERROR", "Could not access shared UserDefaults", nil)
    }
  }
  
  @objc
  func removeSessionToken(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    if let userDefaults = UserDefaults(suiteName: "group.com.piripimartin.dew") {
      userDefaults.removeObject(forKey: "sessionToken")
      userDefaults.synchronize()
      resolve(true)
    } else {
      reject("ERROR", "Could not access shared UserDefaults", nil)
    }
  }
  
  @objc
  func getSessionToken(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    
    if let userDefaults = UserDefaults(suiteName: "group.com.piripimartin.dew") {
      let token = userDefaults.string(forKey: "sessionToken")
      resolve(token ?? NSNull())
    } else {
      reject("ERROR", "Could not access shared UserDefaults", nil)
    }
  }
}
