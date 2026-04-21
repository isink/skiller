import Constants, { ExecutionEnvironment } from "expo-constants";
import { Text, View } from "react-native";

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function NativeBanner() {
  const {
    BannerAd,
    BannerAdSize,
    TestIds,
  } = require("react-native-google-mobile-ads");
  return (
    <BannerAd
      unitId={TestIds.BANNER}
      size={BannerAdSize.BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdFailedToLoad={(err: unknown) => {
        console.warn("[AdMob] failed", err);
      }}
    />
  );
}

export default function BannerAdView() {
  if (isExpoGo) return null;
  return (
    <View className="items-center justify-center py-2" style={{ minHeight: 60, borderWidth: 1, borderColor: "#D97757" }}>
      <Text style={{ position: "absolute", top: 2, left: 6, fontSize: 9, color: "#D97757" }}>AD SLOT (diag)</Text>
      <NativeBanner />
    </View>
  );
}
