import Constants, { ExecutionEnvironment } from "expo-constants";
import { View } from "react-native";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const PROD_AD_UNIT_ID = "ca-app-pub-8372639947150676/9669151238";

function NativeBanner() {
  const {
    BannerAd,
    BannerAdSize,
    TestIds,
  } = require("react-native-google-mobile-ads");
  const unitId = __DEV__ ? TestIds.BANNER : PROD_AD_UNIT_ID;
  return (
    <BannerAd
      unitId={unitId}
      size={BannerAdSize.BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
    />
  );
}

export default function BannerAdView() {
  if (isExpoGo) return null;
  return (
    <View className="items-center py-2">
      <NativeBanner />
    </View>
  );
}
