declare module "hellosign-embedded" {
  type HelloSignOptions = {
    clientId: string;
    skipDomainVerification?: boolean;
  };

  type OpenOptions = {
    allowCancel?: boolean;
    skipDomainVerification?: boolean;
    container?: HTMLElement;
  };

  class HelloSign {
    constructor(options: HelloSignOptions);
    open(url: string, options?: OpenOptions): void;
    close(): void;
    on(event: string, handler: () => void): void;
  }

  export default HelloSign;
}
