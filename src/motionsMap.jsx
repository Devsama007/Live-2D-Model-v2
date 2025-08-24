// motions.js
export const motions = {
  //Tilt Head
  tiltHead: [
    { id: "ParamAngleZ", from: 0, to: 30, duration: 800 },
    { id: "ParamAngleZ", from: 30, to: -30, duration: 1600 },
    { id: "ParamAngleZ", from: -30, to: 0, duration: 800 },
  ],

  //Blink Left
  blinkLeft: [
    { id: "ParamEyeLOpen", from: 1.4, to: 0.0, duration: 200 },
    { id: "ParamEyeLOpen", from: 0.0, to: 1.4, duration: 200 },
  ],

  //Blink Right
  blinkRight: [
    { id: "ParamEyeROpen", from: 1.4, to: 0.0, duration: 200 },
    { id: "ParamEyeROpen", from: 0.0, to: 1.4, duration: 200 },
  ],

  //Eyebrow up
  eyebrowUp: [
    { id: "ParamBrowLY", from: 0, to: 1, duration: 600 },
    { id: "ParamBrowLY", from: 1, to: 0, duration: 600 },
  ],

  //Angry eyebrow
  angryBrow: [
    { id: "ParamBrowLForm", from: 0, to: -1, duration: 600 },
    { id: "ParamBrowLForm", from: -1, to: 0, duration: 600 },
  ],

  //Wide smile
  smile: [
    { id: "ParamMouthForm", from: 0, to: 1, duration: 1000 },
    { id: "ParamMouthForm", from: 1, to: 0, duration: 1000 },
    { id: "ParamMouthForm", from: -1, to: 0, duration: 1000},
  ],

  //Chin Movement
  chinMove: [
    { id: "Param20", from: 0, to: 30, duration: 800 },
    { id: "Param20", from: 30, to: -30, duration: 1600 },
    { id: "Param20", from: -30, to: 0, duration: 800 },
  ],

  //Sway Body
  swayBody: [
    { id: "ParamAngleX", from: 0, to: 30, duration: 400 },
    { id: "ParamAngleX", from: 30, to: -30, duration: 800 },
    { id: "ParamAngleX", from: -30, to: 0, duration: 400 },
  ],

  //Nodding Head
  nodHead: [
    { id: "ParamAngleY", from: 0, to: 30, duration: 400 },
    { id: "ParamAngleY", from: 30, to: -30, duration: 800 },
    { id: "ParamAngleY", from: -30, to: 0, duration: 400 },
  ],

  mouthOpenY: [
    { id: "ParamMouthOpenY", from: 0, to: 1, duration: 600},
    { id: "ParamMouthOpenY", from: 1, to: 0, duration: 600},
  ],

  breath: [
    { id: "ParamBreath", from: 0, to: 1, duration: 600},
    { id: "ParamBreath", from: 1, to: 0, duration: 600},
  ],

  //   param7: [
  //   { id: "Param7", from: 0, to: 30, duration: 400 },
  //   { id: "Param7", from: 30, to: -30, duration: 800 },
  //   { id: "Param7", from: -30, to: 0, duration: 400 },
  // ],
};
