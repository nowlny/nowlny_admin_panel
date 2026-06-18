import { apiClient } from "./apiClient";

export interface AppVersionConfig {
  latestVersionIos: string;
  minSupportedVersionIos: string;
  isUpdateMandatoryIos: boolean;
  allowDismissIos: boolean;
  titleIos: string;
  messageIos: string;
  storeUrlIos: string;

  latestVersionAndroid: string;
  minSupportedVersionAndroid: string;
  isUpdateMandatoryAndroid: boolean;
  allowDismissAndroid: boolean;
  titleAndroid: string;
  messageAndroid: string;
  storeUrlAndroid: string;
}

export const appVersionService = {
  getAppVersion: async () => {
    return apiClient<AppVersionConfig>("/api/v1/app-version", {
      method: "GET",
    });
  },
  updateAppVersion: async (data: AppVersionConfig) => {
    return apiClient<AppVersionConfig>("/api/v1/app-version", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};
