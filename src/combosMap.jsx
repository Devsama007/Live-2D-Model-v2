// combosMap.jsx
export const combos = {
    A: {
        name: "Happy Tilt",
        expressions: [{ id: "Param11", value: 30 }], // happy
        motions: [
            { id: "ParamAngleY", from: 0, to: 30, duration: 800 },
            { id: "ParamAngleY", from: 30, to: -30, duration: 800 },
            { id: "ParamAngleY", from: -30, to: 0, duration: 800 },
        ],
    },

    B: {
        name: "Angry Shake",
        expressions: [{ id: "Param17", value: 30 }], // angry
        motions: [
            { id: "ParamAngleX", from: 0, to: 30, duration: 800 },
            { id: "ParamAngleX", from: 30, to: -30, duration: 800 },
            { id: "ParamAngleX", from: -30, to: 0, duration: 800 },
        ],
    },

    C: {
        name: "Sad Chin",
        expressions: [{ id: "Param22", value: 30 }], // cry
        motions: [
            { id: "Param20", from: 0, to: 10, duration: 300 },
            { id: "Param20", from: 10, to: -10, duration: 300 },
            { id: "Param20", from: -10, to: 0, duration: 300 },
        ],
    },

    D: {
        name: "Cheeky Tongue",
        expressions: [
            { id: "Param19", value: 30 }, // tongue
        ],
        motions: [
            { id: "ParamAngleX", from: 0, to: 30, duration: 800 },
            { id: "ParamAngleX", from: 30, to: -30, duration: 800 },
            { id: "ParamAngleX", from: -30, to: 0, duration: 800 },
        ],
    },

    E: {
        name: "Pose + Smile",
        expressions: [
            { id: "Param43", value: 30 }, // pose1
        ],
        motions: [
            { id: "ParamMouthForm", from: 0, to: 1, duration: 1000 },
            { id: "ParamMouthForm", from: 1, to: 0, duration: 1000 },
        ],
    },

    F: {
        name: "Cheeky Shake",
        expressions: [
            { id: "Param19", value: 30 }, // tongue
        ],
        motions: [
            { id: "ParamAngleZ", from: 0, to: 30, duration: 800 },
            { id: "ParamAngleZ", from: 30, to: -30, duration: 800 },
            { id: "ParamAngleZ", from: -30, to: 0, duration: 800 },
        ],
    },

    G: {
        name: "Frown",
        expressions: [
            { id: "Param17", value: 30 }, // pose1
        ],
        motions: [
            { id: "ParamBrowLForm", from: 0, to: -1, duration: 1000 },
            { id: "ParamBrowLForm", from: -1, to: 0, duration: 8000 },
        ],
    },

    H: {
        name: "Sparkle Pose",
        expressions: [
            { id: "Param11", value: 30 }, // pose2
            { id: "Param44", value: 30 },
        ],
        motions: [
            { id: "ParamBrowLY", from: 0, to: 1, duration: 1000 },
            { id: "ParamBrowLY", from: 1, to: 0, duration: 8000 },
        ],
    },
};
