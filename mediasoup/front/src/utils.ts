interface MediaDevicesExtended extends MediaDevices {
  getDisplayMedia: (
    constraints: MediaStreamConstraints,
  ) => Promise<MediaStream>;
}
export class Utils {
  static async getUserMedia(
    constraints: MediaStreamConstraints,
    isDisplay: boolean = false,
  ): Promise<MediaStream> {
    if (isDisplay) {
      return await (navigator.mediaDevices as MediaDevicesExtended).getDisplayMedia(
        constraints,
      );
    } else {
      return await navigator.mediaDevices.getUserMedia(constraints);
    }
  }
  static isFirefox = typeof (window as any).InstallTrigger !== 'undefined';
  static isOpera =
    !!(window as any).opera || navigator.userAgent.indexOf(' OPR/') >= 0;
  static isChrome = !!(window as any).chrome && !Utils.isOpera;
  static isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
