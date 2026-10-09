import { HttpInterceptorFn } from '@angular/common/http';
import { jwtInterceptor } from './jwt.interceptor';

/**
 * Re-export pour compatibilité descendante
 */
export const authInterceptor: HttpInterceptorFn = jwtInterceptor;
