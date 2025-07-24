import { Config } from '@ton/blueprint';

export const config: Config = {
  network: {
    type:     'testnet',
    endpoint: 'https://testnet.toncenter.com/api/v2',
    version:  'v2',
    key:      process.env.TONCENTER_KEY,
  },

};