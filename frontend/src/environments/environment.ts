type RuntimeEnvironment = {
    googleClientId?: string;
};

declare global {
    interface Window {
        __OMS_ENV__?: RuntimeEnvironment;
    }
}

export const environment = {
    production: false,
    googleClientId: window.__OMS_ENV__?.googleClientId ?? ''
};
