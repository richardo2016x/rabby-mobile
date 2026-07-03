import { registerAppScreen } from '@/perfs/apis';

export const DuplicateAddressModal = registerAppScreen<
  typeof import('@/screens/Address/components/DuplicateAddressModal').DuplicateAddressModal
>({
  loader: () =>
    import('@/screens/Address/components/DuplicateAddressModal').then(m => ({
      default: m.DuplicateAddressModal,
    })),
  name: 'DuplicateAddressModal',
});

export const AliasNameEditModal = registerAppScreen<
  typeof import('@/components2024/AliasNameEditModal/AliasNameEditModal').AliasNameEditModal
>({
  loader: () =>
    import('@/components2024/AliasNameEditModal/AliasNameEditModal').then(
      m => ({
        default: m.AliasNameEditModal,
      }),
    ),
  name: 'AliasNameEditModal',
});

export const QrCodeModal = registerAppScreen<
  typeof import('@/components2024/QrCodeModal/QrCodeModal').QrCodeModal
>({
  loader: () =>
    import('@/components2024/QrCodeModal/QrCodeModal').then(m => ({
      default: m.QrCodeModal,
    })),
  name: 'QrCodeModal',
});

export const InnerDappWebViewPreloadEntry = registerAppScreen<
  typeof import('@/components/WebView/InnerDappWebViewPreloadEntry').InnerDappWebViewPreloadEntry
>({
  loader: () =>
    import('@/components/WebView/InnerDappWebViewPreloadEntry').then(m => ({
      default: m.InnerDappWebViewPreloadEntry,
    })),
  name: 'InnerDappWebViewPreloadEntry',
});

export const ApprovalTokenDetailSheetModalStub = registerAppScreen<
  typeof import('@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub').default
>({
  loader: () =>
    import('@/components/TokenDetailPopup/ApprovalTokenDetailSheetModalStub'),
  name: 'ApprovalTokenDetailSheetModalStub',
});

export const BottomSheetBrowser = registerAppScreen<
  typeof import('@/screens/Browser/BottomSheetBrowser').BottomSheetBrowser
>({
  loader: () =>
    import('@/screens/Browser/BottomSheetBrowser').then(m => ({
      default: m.BottomSheetBrowser,
    })),
  name: 'BottomSheetBrowser',
});

export const BrowserManagePopup = registerAppScreen<
  typeof import('@/screens/Browser/BottomSheetBrowser').BrowserManagePopup
>({
  loader: () =>
    import('@/screens/Browser/BottomSheetBrowser').then(m => ({
      default: m.BrowserManagePopup,
    })),
  name: 'BrowserManagePopup',
});

export const BrowserFavoritePopup = registerAppScreen<
  typeof import('@/screens/Browser/BottomSheetBrowser').BrowserFavoritePopup
>({
  loader: () =>
    import('@/screens/Browser/BottomSheetBrowser').then(m => ({
      default: m.BrowserFavoritePopup,
    })),
  name: 'BrowserFavoritePopup',
});

export const BottomSheetDappInfoPopup = registerAppScreen<
  typeof import('@/screens/Browser/BottomSheetBrowser').BottomSheetDappInfoPopup
>({
  loader: () =>
    import('@/screens/Browser/BottomSheetBrowser').then(m => ({
      default: m.BottomSheetDappInfoPopup,
    })),
  name: 'BottomSheetDappInfoPopup',
});

export const ModalsSubmitFeedbackByScreenshotStub = registerAppScreen<
  typeof import('@/components/Screenshot/ScreenshotModal').ModalsSubmitFeedbackByScreenshotStub
>({
  loader: () =>
    import('@/components/Screenshot/ScreenshotModal').then(m => ({
      default: m.ModalsSubmitFeedbackByScreenshotStub,
    })),
  name: 'ModalsSubmitFeedbackByScreenshotStub',
});

export const ToggleCollateralModal = registerAppScreen<
  typeof import('@/screens/Lending/modals/ToggleCollateralModal').ToggleCollateralModal
>({
  loader: () =>
    import('@/screens/Lending/modals/ToggleCollateralModal').then(m => ({
      default: m.ToggleCollateralModal,
    })),
  name: 'ToggleCollateralModal',
});

export const GlobalSecurityTipStubModal = registerAppScreen<
  typeof import('@/components/Security/SecurityTipStubModal').default
>({
  loader: () => import('@/components/Security/SecurityTipStubModal'),
  name: 'GlobalSecurityTipStubModal',
});

export const BackgroundSecureBlurView = registerAppScreen<
  typeof import('@/components/customized/BackgroundSecureBlurView').BackgroundSecureBlurView
>({
  loader: () =>
    import('@/components/customized/BackgroundSecureBlurView').then(m => ({
      default: m.BackgroundSecureBlurView,
    })),
  name: 'BackgroundSecureBlurView',
});

export const FloatingDiagnosticsPanel = registerAppScreen<
  typeof import('@/screens/Settings/components/FloatingDiagnosticsPanel').FloatingDiagnosticsPanel
>({
  loader: () =>
    import('@/screens/Settings/components/FloatingDiagnosticsPanel').then(
      m => ({
        default: m.FloatingDiagnosticsPanel,
      }),
    ),
  name: 'FloatingDiagnosticsPanel',
});

export const WideScreenDebugPanel = registerAppScreen<
  typeof import('@/components/Debug/WideScreenDebugPanel').WideScreenDebugPanel
>({
  loader: () =>
    import('@/components/Debug/WideScreenDebugPanel').then(m => ({
      default: m.WideScreenDebugPanel,
    })),
  name: 'WideScreenDebugPanel',
});

export const GlobalMiniApproval = registerAppScreen<
  typeof import('@/components/Approval/components/MiniSignTx/GlobalMiniApproval').GlobalMiniApproval
>({
  loader: () =>
    import(
      '@/components/Approval/components/MiniSignTx/GlobalMiniApproval'
    ).then(m => ({
      default: m.GlobalMiniApproval,
    })),
  name: 'GlobalMiniApproval',
});

export const GlobalMiniSignTypedDataPortal = registerAppScreen<
  typeof import('@/components/Approval/components/MiniSignTypedData/GlobalMiniSignTypedDataPortal').GlobalMiniSignTypedDataPortal
>({
  loader: () =>
    import(
      '@/components/Approval/components/MiniSignTypedData/GlobalMiniSignTypedDataPortal'
    ).then(m => ({
      default: m.GlobalMiniSignTypedDataPortal,
    })),
  name: 'GlobalMiniSignTypedDataPortal',
});

export const GlobalTipsPopup = registerAppScreen<
  typeof import('@/components2024/GlobalTipsPopup').GlobalTipsPopup
>({
  loader: () =>
    import('@/components2024/GlobalTipsPopup').then(m => ({
      default: m.GlobalTipsPopup,
    })),
  name: 'GlobalTipsPopup',
});

export const GlobalSignerPortal = registerAppScreen<
  typeof import('@/components2024/MiniSignV2/components/GlobalSignerPortal').GlobalSignerPortal
>({
  loader: () =>
    import('@/components2024/MiniSignV2/components/GlobalSignerPortal').then(
      m => ({
        default: m.GlobalSignerPortal,
      }),
    ),
  name: 'GlobalSignerPortal',
});

export const WalletConnectModalHost = registerAppScreen<
  typeof import('@/components2024/WalletConnect/WalletConnectModalHost').WalletConnectModalHost
>({
  loader: () =>
    import('@/components2024/WalletConnect/WalletConnectModalHost').then(m => ({
      default: m.WalletConnectModalHost,
    })),
  name: 'WalletConnectModalHost',
});
