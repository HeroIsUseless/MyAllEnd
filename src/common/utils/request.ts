import { PostRequest } from './types/func';
import pkg from '../../../package.json';
import { loadAllCookies, saveAllCookies } from './cookies';
import { isDev } from '.';

export interface PostRequestAdaptor {
  (url: string, data: any): Promise<any>;
}

let _postRequest: PostRequest;

export function initPostFunction(postFunc: PostRequest) {
    _postRequest = postFunc;
}

export const postRequest: PostRequestAdaptor = (url, data) => {
  console.log('【request】', url);
  if (_postRequest) {
    return new Promise(async (resolve, reject) => {
      data = data || {};
      data.appName = pkg.name;
      data.appVersion = pkg.version;
      const cookies = await loadAllCookies();
      _postRequest(url, data, cookies).then(
        ({ res, netCode, setCookie, err }) => {
          console.log('【response】', url, netCode, res);
          if (res) {
            if (setCookie) {
              saveAllCookies(setCookie);
            }
            resolve(res);
          } else {
            reject(err);
          }
        },
      );
    });
  } else {
    return Promise.reject(undefined);
  }
};
