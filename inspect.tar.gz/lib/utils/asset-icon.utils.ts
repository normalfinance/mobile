export interface AssetIconConfig {
  bgColor: string;
  textIcon: string;
  imageSource?: any;
}

export interface AssetIconData {
  symbol: string;
  hasImage: boolean;
  imagePath?: string;
  fallback: AssetIconConfig;
}

export const cryptoIcons: Record<string, any> = {
  USDC: require("@/assets/icons/crypto-icons/USDC.webp"),
  XLM: require("@/assets/icons/crypto-icons/XLM.webp"),

  nAAVE: require("@/assets/icons/crypto-icons/nAAVE.webp"),
  nADA: require("@/assets/icons/crypto-icons/nADA.webp"),
  nAERO: require("@/assets/icons/crypto-icons/nAERO.webp"),
  nALGO: require("@/assets/icons/crypto-icons/nALGO.webp"),
  nAPT: require("@/assets/icons/crypto-icons/nAPT.webp"),
  nARB: require("@/assets/icons/crypto-icons/nARB.webp"),
  nATOM: require("@/assets/icons/crypto-icons/nATOM.webp"),
  nAVAX: require("@/assets/icons/crypto-icons/nAVAX.webp"),
  nBCH: require("@/assets/icons/crypto-icons/nBCH.webp"),
  nBGB: require("@/assets/icons/crypto-icons/nBGB.webp"),
  nBNB: require("@/assets/icons/crypto-icons/nBNB.webp"),
  nBONK: require("@/assets/icons/crypto-icons/nBONK.webp"),
  nBRETT: require("@/assets/icons/crypto-icons/nBRETT.webp"),
  nBSV: require("@/assets/icons/crypto-icons/nBSV.webp"),
  nBTC: require("@/assets/icons/crypto-icons/nBTC.webp"),
  nBTT: require("@/assets/icons/crypto-icons/nBTT.webp"),
  nCAKE: require("@/assets/icons/crypto-icons/nCAKE.webp"),
  nCORE: require("@/assets/icons/crypto-icons/nCORE.webp"),
  nCRO: require("@/assets/icons/crypto-icons/nCRO.webp"),
  nCRV: require("@/assets/icons/crypto-icons/nCRV.webp"),
  nDAI: require("@/assets/icons/crypto-icons/nDAI.webp"),
  nDEXE: require("@/assets/icons/crypto-icons/nDEXE.webp"),
  nDOGE: require("@/assets/icons/crypto-icons/nDOGE.webp"),
  nDOT: require("@/assets/icons/crypto-icons/nDOT.webp"),
  nENA: require("@/assets/icons/crypto-icons/nENA.webp"),
  nENS: require("@/assets/icons/crypto-icons/nENS.webp"),
  nETC: require("@/assets/icons/crypto-icons/nETC.webp"),
  nETH: require("@/assets/icons/crypto-icons/nETH.webp"),
  nFARTCOIN: require("@/assets/icons/crypto-icons/nFARTCOIN.webp"),
  nFET: require("@/assets/icons/crypto-icons/nFET.webp"),
  nFIL: require("@/assets/icons/crypto-icons/nFIL.webp"),
  nFLOKI: require("@/assets/icons/crypto-icons/nFLOKI.webp"),
  nFLOW: require("@/assets/icons/crypto-icons/nFLOW.webp"),
  nFLR: require("@/assets/icons/crypto-icons/nFLR.webp"),
  nFORM: require("@/assets/icons/crypto-icons/nFORM.webp"),
  nGALA: require("@/assets/icons/crypto-icons/nGALA.webp"),
  nGRT: require("@/assets/icons/crypto-icons/nGRT.webp"),
  nGT: require("@/assets/icons/crypto-icons/nGT.webp"),
  nHBAR: require("@/assets/icons/crypto-icons/nHBAR.webp"),
  nHNT: require("@/assets/icons/crypto-icons/nHNT.webp"),
  nHYPE: require("@/assets/icons/crypto-icons/nHYPE.webp"),
  nICP: require("@/assets/icons/crypto-icons/nICP.webp"),
  nIMX: require("@/assets/icons/crypto-icons/nIMX.webp"),
  nINJ: require("@/assets/icons/crypto-icons/nINJ.webp"),
  nIOTA: require("@/assets/icons/crypto-icons/nIOTA.webp"),
  nIP: require("@/assets/icons/crypto-icons/nIP.webp"),
  nJASMY: require("@/assets/icons/crypto-icons/nJASMY.webp"),
  nJUP: require("@/assets/icons/crypto-icons/nJUP.webp"),
  nKAIA: require("@/assets/icons/crypto-icons/nKAIA.webp"),
  nKAS: require("@/assets/icons/crypto-icons/nKAS.webp"),
  nKCS: require("@/assets/icons/crypto-icons/nKCS.webp"),
  nLDO: require("@/assets/icons/crypto-icons/nLDO.webp"),
  nLEO: require("@/assets/icons/crypto-icons/nLEO.webp"),
  nLINK: require("@/assets/icons/crypto-icons/nLINK.webp"),
  nLTC: require("@/assets/icons/crypto-icons/nLTC.webp"),
  nMANA: require("@/assets/icons/crypto-icons/nMANA.webp"),
  nMKR: require("@/assets/icons/crypto-icons/nMKR.webp"),
  nMNT: require("@/assets/icons/crypto-icons/nMNT.webp"),
  nNEAR: require("@/assets/icons/crypto-icons/nNEAR.webp"),
  nNEXO: require("@/assets/icons/crypto-icons/nNEXO.webp"),
  nNORM: require("@/assets/icons/crypto-icons/nNORM.webp"),
  nOKB: require("@/assets/icons/crypto-icons/nOKB.webp"),
  nONDO: require("@/assets/icons/crypto-icons/nONDO.webp"),
  nOP: require("@/assets/icons/crypto-icons/nOP.webp"),
  nPAXG: require("@/assets/icons/crypto-icons/nPAXG.webp"),
  nPENDLE: require("@/assets/icons/crypto-icons/nPENDLE.webp"),
  nPENGU: require("@/assets/icons/crypto-icons/nPENGU.webp"),
  nPEPE: require("@/assets/icons/crypto-icons/nPEPE.webp"),
  nPI: require("@/assets/icons/crypto-icons/nPI.webp"),
  nPOL: require("@/assets/icons/crypto-icons/nPOL.webp"),
  nPRO: require("@/assets/icons/crypto-icons/nPRO.webp"),
  nPYUSD: require("@/assets/icons/crypto-icons/nPYUSD.webp"),
  nQNT: require("@/assets/icons/crypto-icons/nQNT.webp"),
  nRAY: require("@/assets/icons/crypto-icons/nRAY.webp"),
  nRENDER: require("@/assets/icons/crypto-icons/nRENDER.webp"),
  nRUNE: require("@/assets/icons/crypto-icons/nRUNE.webp"),
  nS: require("@/assets/icons/crypto-icons/nS.webp"),
  nSAND: require("@/assets/icons/crypto-icons/nSAND.webp"),
  nSEI: require("@/assets/icons/crypto-icons/nSEI.webp"),
  nSHIB: require("@/assets/icons/crypto-icons/nSHIB.webp"),
  nSOL: require("@/assets/icons/crypto-icons/nSOL.webp"),
  nSPX: require("@/assets/icons/crypto-icons/nSPX.webp"),
  nSTX: require("@/assets/icons/crypto-icons/nSTX.webp"),
  nSUI: require("@/assets/icons/crypto-icons/nSUI.webp"),
  nTAO: require("@/assets/icons/crypto-icons/nTAO.webp"),
  nTHETA: require("@/assets/icons/crypto-icons/nTHETA.webp"),
  nTIA: require("@/assets/icons/crypto-icons/nTIA.webp"),
  nTON: require("@/assets/icons/crypto-icons/nTON.webp"),
  nTRUMP: require("@/assets/icons/crypto-icons/nTRUMP.webp"),
  nTRX: require("@/assets/icons/crypto-icons/nTRX.webp"),
  nUNI: require("@/assets/icons/crypto-icons/nUNI.webp"),
  nUSDC: require("@/assets/icons/crypto-icons/nUSDC.webp"),
  nUSDT: require("@/assets/icons/crypto-icons/nUSDT.webp"),
  nVET: require("@/assets/icons/crypto-icons/nVET.webp"),
  nVIRTUAL: require("@/assets/icons/crypto-icons/nVIRTUAL.webp"),
  nWAL: require("@/assets/icons/crypto-icons/nWAL.webp"),
  nWIF: require("@/assets/icons/crypto-icons/nWIF.webp"),
  nWLD: require("@/assets/icons/crypto-icons/nWLD.webp"),
  nXAUt: require("@/assets/icons/crypto-icons/nXAUt.webp"),
  nXDC: require("@/assets/icons/crypto-icons/nXDC.webp"),
  nXMR: require("@/assets/icons/crypto-icons/nXMR.webp"),
  nXRP: require("@/assets/icons/crypto-icons/nXRP.webp"),
  nXTZ: require("@/assets/icons/crypto-icons/nXTZ.webp"),
  nZEC: require("@/assets/icons/crypto-icons/nZEC.webp")
};

const getAssetImagePath = (symbol: string): string | null => {
  try {
    const webpPath = `@/assets/icons/crypto-icons/${symbol}.webp`;

    return webpPath;
  } catch {
    return null;
  }
};

const getFallbackIconConfig = (symbol: string): AssetIconConfig => {
  const iconMap: Record<string, AssetIconConfig> = {
    XLM: { bgColor: "$black", textIcon: "✦" },
    nBTC: { bgColor: "#f7931a", textIcon: "₿" },
    nETH: { bgColor: "#627eea", textIcon: "Ξ" },
    nSOL: { bgColor: "#9945ff", textIcon: "S" },
    BTC: { bgColor: "#f7931a", textIcon: "₿" },
    ETH: { bgColor: "#627eea", textIcon: "Ξ" },
    SOL: { bgColor: "#9945ff", textIcon: "S" },
    USDC: { bgColor: "$blue9", textIcon: "$" },
    USDT: { bgColor: "$green9", textIcon: "$" },
    nUSD: { bgColor: "$green9", textIcon: "$" },
    nTESLA: { bgColor: "$red9", textIcon: "T" },
    "nS&P500": { bgColor: "$blue9", textIcon: "S" },
    nAAVE: { bgColor: "#B6509E", textIcon: "A" },
    nADA: { bgColor: "#0033AD", textIcon: "A" },
    nAERO: { bgColor: "#00D4AA", textIcon: "A" },
    nALGO: { bgColor: "#000000", textIcon: "A" },
    nAPT: { bgColor: "#00E4CC", textIcon: "A" },
    nARB: { bgColor: "#28A0F0", textIcon: "A" },
    nATOM: { bgColor: "#2E3148", textIcon: "A" },
    nAVAX: { bgColor: "#E84142", textIcon: "A" },
    nBCH: { bgColor: "#8DC351", textIcon: "B" },
    nBGB: { bgColor: "#00D4AA", textIcon: "B" },
    nBNB: { bgColor: "#F3BA2F", textIcon: "B" },
    nBONK: { bgColor: "#FFA500", textIcon: "B" },
    nBRETT: { bgColor: "#1E90FF", textIcon: "B" },
    nBSV: { bgColor: "#EAB300", textIcon: "B" },
    nBTT: { bgColor: "#FF0000", textIcon: "B" },
    nCAKE: { bgColor: "#D1884F", textIcon: "C" },
    nCORE: { bgColor: "#FF6B35", textIcon: "C" },
    nCRO: { bgColor: "#103F68", textIcon: "C" },
    nCRV: { bgColor: "#F3E500", textIcon: "C" },
    nDAI: { bgColor: "#F5AC37", textIcon: "D" },
    nDEXE: { bgColor: "#4A90E2", textIcon: "D" },
    nDOGE: { bgColor: "#C2A633", textIcon: "D" },
    nDOT: { bgColor: "#E6007A", textIcon: "D" },
    nENA: { bgColor: "#00C9FF", textIcon: "E" },
    nENS: { bgColor: "#5298FF", textIcon: "E" },
    nETC: { bgColor: "#328332", textIcon: "E" },
    nFARTCOIN: { bgColor: "#8B4513", textIcon: "F" },
    nFET: { bgColor: "#02D9F7", textIcon: "F" },
    nFIL: { bgColor: "#0090FF", textIcon: "F" },
    nFLOKI: { bgColor: "#F4C430", textIcon: "F" },
    nFLOW: { bgColor: "#00EF8B", textIcon: "F" },
    nFLR: { bgColor: "#FF0080", textIcon: "F" },
    nFORM: { bgColor: "#32CD32", textIcon: "F" },
    nGALA: { bgColor: "#000000", textIcon: "G" },
    nGRT: { bgColor: "#6F4CFF", textIcon: "G" },
    nGT: { bgColor: "#FF8C00", textIcon: "G" },
    nHBAR: { bgColor: "#000000", textIcon: "H" },
    nHNT: { bgColor: "#474DFF", textIcon: "H" },
    nHYPE: { bgColor: "#FF69B4", textIcon: "H" },
    nICP: { bgColor: "#29ABE2", textIcon: "I" },
    nIMX: { bgColor: "#000000", textIcon: "I" },
    nINJ: { bgColor: "#00D4AA", textIcon: "I" },
    nIOTA: { bgColor: "#242424", textIcon: "I" },
    nIP: { bgColor: "#4169E1", textIcon: "I" },
    nJASMY: { bgColor: "#00C9FF", textIcon: "J" },
    nJUP: { bgColor: "#32CD32", textIcon: "J" }
  };

  return (
    iconMap[symbol] || {
      bgColor: "$purple500",
      textIcon: symbol.charAt(0).toUpperCase()
    }
  );
};

export const getAssetIconData = (symbol: string): AssetIconData => {
  if (!symbol) {
    return {
      symbol: "",
      hasImage: false,
      fallback: { bgColor: "$gray500", textIcon: "?" }
    };
  }

  const imagePath = getAssetImagePath(symbol);
  const fallback = getFallbackIconConfig(symbol);

  return {
    symbol,
    hasImage: !!imagePath,
    imagePath: imagePath || undefined,
    fallback
  };
};

export const getAssetImageSource = (symbol: string) => {
  if (!symbol) return null;

  try {
    const iconAssets = require("@/assets/icons/crypto-icons");

    if (iconAssets[`${symbol}.webp`]) {
      return iconAssets[`${symbol}.webp`];
    }

    if (iconAssets[`${symbol}.png`]) {
      return iconAssets[`${symbol}.png`];
    }

    return null;
  } catch {
    return null;
  }
};

export const isNormalToken = (symbol: string): boolean => {
  return symbol.startsWith("n");
};

export const getBaseSymbol = (symbol: string): string => {
  return isNormalToken(symbol) ? symbol.substring(1) : symbol;
};
