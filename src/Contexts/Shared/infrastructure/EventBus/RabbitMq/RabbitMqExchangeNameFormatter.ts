export class RabbitMqExchangeNameFormatter {
  static format(eventName: string): string {
    return eventName;
  }

  static queue(params: {
    appName: string;
    eventName: string;
    subscriberName: string;
  }): string {
    return `${params.appName}.${params.eventName}.${params.subscriberName}`;
  }
}
