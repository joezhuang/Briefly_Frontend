import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "briefly.auth.returnTo";

export async function saveAuthReturnPath(path: string) {
  await AsyncStorage.setItem(KEY, path);
}

export async function readAuthReturnPath() {
  return (await AsyncStorage.getItem(KEY)) ?? undefined;
}

export async function clearAuthReturnPath() {
  await AsyncStorage.removeItem(KEY);
}
