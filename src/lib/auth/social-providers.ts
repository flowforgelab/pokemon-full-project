export const socialProviders = {
  oauth: {
    google: {
      enabled: true,
      name: 'Google',
      icon: 'google',
      scopes: ['email', 'profile'],
    },
    apple: {
      enabled: true,
      name: 'Apple',
      icon: 'apple',
      scopes: ['email', 'name'],
    },
    discord: {
      enabled: true,
      name: 'Discord',
      icon: 'discord',
      scopes: ['identify', 'email'],
    },
    github: {
      enabled: false,
      name: 'GitHub',
      icon: 'github',
      scopes: ['read:user', 'user:email'],
    },
    twitter: {
      enabled: false,
      name: 'Twitter',
      icon: 'twitter',
      scopes: ['users.read'],
    },
  },
  web3: {
    metamask: {
      enabled: false,
      name: 'MetaMask',
      icon: 'metamask',
    },
    walletconnect: {
      enabled: false,
      name: 'WalletConnect',
      icon: 'walletconnect',
    },
  },
};

export const getEnabledProviders = () => {
  const enabled: string[] = [];
  
  Object.entries(socialProviders.oauth).forEach(([key, provider]) => {
    if (provider.enabled) {
      enabled.push(key);
    }
  });
  
  return enabled;
};

export const getProviderConfig = (provider: string) => {
  return socialProviders.oauth[provider as keyof typeof socialProviders.oauth] || null;
};