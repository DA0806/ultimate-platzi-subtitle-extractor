import { defaultAuthorizationService } from './authorizationService.js';

/**
 * @file platziAuth.js
 * UPSE no almacena, captura ni procesa contraseñas, cookies manuales ni tokens falsos.
 * La sesión se basa exclusivamente en el perfil de navegación del usuario en Platzi
 * y cualquier derecho premium requiere un contrato oficial con la plataforma.
 */

export const checkPlatformSession = async () => {
  const result = await defaultAuthorizationService.adapter.checkSession();
  return result?.status === 'verified' && result.authenticated === true && result.accountId && Number.isInteger(result.sessionEpoch) && Number.isFinite(result.expiresAt) && result.expiresAt > Date.now()
    ? result
    : { status: 'unknown', entitlements: [] };
};
