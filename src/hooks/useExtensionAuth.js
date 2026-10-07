import { isExtension } from '../utils/platziClient';

export const useExtensionAuth = () => ({
  browserAccess: isExtension(),
  useBrowserSession: () => isExtension(),
});
