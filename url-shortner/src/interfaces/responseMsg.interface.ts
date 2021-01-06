import { UrlDetails } from './url-data.interface';
interface resposnseMsg {
    message: string,
    data?: Array<UrlDetails> | UrlDetails
}

export { resposnseMsg };