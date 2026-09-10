import * as ExpoCrypto from "expo-crypto";
import { Platform } from "react-native";

type IntegerArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array;

type NativeCryptoBridge = {
  getRandomValues: <T extends IntegerArray>(array: T) => T;
  subtle: {
    digest: (
      algorithm: string | { name: string },
      data: ArrayBuffer | ArrayBufferView,
    ) => Promise<ArrayBuffer>;
  };
};

class NativeTextEncoder {
  readonly encoding = "utf-8";

  encode(input = "") {
    const bytes: number[] = [];

    for (let index = 0; index < input.length; index += 1) {
      let codePoint = input.codePointAt(index);
      if (codePoint == null) continue;

      if (codePoint > 0xffff) index += 1;

      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        bytes.push(
          0xc0 | (codePoint >> 6),
          0x80 | (codePoint & 0x3f),
        );
      } else if (codePoint <= 0xffff) {
        bytes.push(
          0xe0 | (codePoint >> 12),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f),
        );
      } else {
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f),
        );
      }
    }

    return new Uint8Array(bytes);
  }
}

function normalizeDigestAlgorithm(algorithm: string | { name: string }) {
  return (typeof algorithm === "string" ? algorithm : algorithm.name)
    .toUpperCase()
    .replace(/_/g, "-");
}

if (Platform.OS !== "web") {
  const runtime = globalThis as typeof globalThis & {
    crypto?: Partial<NativeCryptoBridge>;
    TextEncoder?: typeof NativeTextEncoder;
  };

  if (!runtime.TextEncoder) {
    Object.defineProperty(runtime, "TextEncoder", {
      configurable: true,
      value: NativeTextEncoder,
    });
  }

  const cryptoObject = runtime.crypto ?? {};

  if (!cryptoObject.getRandomValues) {
    cryptoObject.getRandomValues = <T extends IntegerArray>(array: T) =>
      ExpoCrypto.getRandomValues(array);
  }

  if (!cryptoObject.subtle) {
    cryptoObject.subtle = {
      digest: async (
        algorithm: string | { name: string },
        data: ArrayBuffer | ArrayBufferView,
      ) => {
        const normalized = normalizeDigestAlgorithm(algorithm);
        if (normalized !== "SHA-256") {
          throw new Error(
            `Native WebCrypto bridge only supports SHA-256 digest, received ${normalized}.`,
          );
        }

        return ExpoCrypto.digest(
          ExpoCrypto.CryptoDigestAlgorithm.SHA256,
          data,
        );
      },
    };
  }

  if (!runtime.crypto) {
    Object.defineProperty(runtime, "crypto", {
      configurable: true,
      value: cryptoObject,
    });
  }
}
