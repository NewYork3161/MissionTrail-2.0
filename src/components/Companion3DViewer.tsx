// src/components/Companion3DViewer.tsx

import React, { Suspense, useEffect } from "react";
import { StyleSheet, View } from "react-native";

import { Canvas } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";


// ====================================================
// MODEL
// ====================================================

const MODEL_PATH = "/glbModels/Draggon.glb";


// ====================================================
// ⭐⭐⭐ ANIMATION SPEED CONTROL ⭐⭐⭐
// ====================================================
//
// Change this number to control animation speed.
//
// 0.5 = half speed
// 1   = normal speed
// 2   = twice as fast
// 5   = five times as fast
//
// ====================================================

const ANIMATION_SPEED = 1;


// ====================================================
// ⭐⭐⭐ MODEL SIZE CONTROL ⭐⭐⭐
// ====================================================
//
// THIS CONTROLS HOW BIG THE DRAGON APPEARS.
//
// 1   = original size
// 1.5 = 50% bigger
// 2   = twice as big
// 2.5 = two-and-a-half times as big
// 3   = three times as big
// 4   = four times as big
//
// Change ONLY this number to resize the dragon.
//
// ====================================================

const MODEL_SCALE = 1.5;


// ====================================================
// ⭐⭐⭐ MODEL POSITION CONTROL ⭐⭐⭐
// ====================================================
//
// X = left / right
// Y = up / down
// Z = forward / backward
//
// Example:
//
// [0, 0.2, 0]
//
// moves the dragon slightly upward.
//
// ====================================================

const MODEL_POSITION_X = 0;
const MODEL_POSITION_Y = 0;
const MODEL_POSITION_Z = 0;


// ====================================================
// ⭐⭐⭐ MODEL ROTATION CONTROL ⭐⭐⭐
// ====================================================
//
// These values are in radians.
//
// Usually leave these at 0 unless the model
// needs to be turned.
//
// ====================================================

const MODEL_ROTATION_X = 0;
const MODEL_ROTATION_Y = 0;
const MODEL_ROTATION_Z = 0;


// ====================================================
// ⭐⭐⭐ CAMERA CONTROL ⭐⭐⭐
// ====================================================
//
// CAMERA_Z controls how far the camera is
// from the dragon.
//
// Smaller number = camera closer = dragon looks bigger
// Larger number  = camera farther = dragon looks smaller
//
// Normally resize with MODEL_SCALE first.
//
// ====================================================

const CAMERA_X = 0;
const CAMERA_Y = 0;
const CAMERA_Z = 5;

const CAMERA_FOV = 45;


// ====================================================
// GLB MODEL
// ====================================================

function GLBModel() {
  const gltf = useGLTF(MODEL_PATH);

  const { actions, names } = useAnimations(
    gltf.animations,
    gltf.scene
  );


  // ==================================================
  // PLAY ANIMATION
  // ==================================================

  useEffect(() => {
    const animationName = names[0];

    if (!animationName) {
      console.warn(
        "[Companion3DViewer] No animation found in GLB."
      );

      return;
    }


    const action = actions[animationName];

    if (!action) {
      console.warn(
        "[Companion3DViewer] Animation action could not be created:",
        animationName
      );

      return;
    }


    console.log(
      "[Companion3DViewer] Playing animation:",
      animationName
    );

    console.log(
      "[Companion3DViewer] Animation speed:",
      ANIMATION_SPEED
    );


    // Reset animation to beginning.
    action.reset();


    // Apply animation speed.
    action.setEffectiveTimeScale(
      ANIMATION_SPEED
    );


    // Start animation.
    action.play();


    // Stop animation when component is removed.
    return () => {
      action.stop();
    };

  }, [actions, names]);


  // ==================================================
  // RENDER MODEL
  // ==================================================

  return (
    <primitive
      object={gltf.scene}

      scale={MODEL_SCALE}

      position={[
        MODEL_POSITION_X,
        MODEL_POSITION_Y,
        MODEL_POSITION_Z,
      ]}

      rotation={[
        MODEL_ROTATION_X,
        MODEL_ROTATION_Y,
        MODEL_ROTATION_Z,
      ]}
    />
  );
}


// ====================================================
// COMPANION 3D VIEWER
// ====================================================

export default function Companion3DViewer() {

  return (
    <View style={styles.container}>

      <Canvas

        camera={{
          position: [
            CAMERA_X,
            CAMERA_Y,
            CAMERA_Z,
          ],

          fov: CAMERA_FOV,
        }}

        gl={{
          alpha: true,
        }}

      >

        {/* ==========================================
            LIGHTING
            ========================================== */}

        <ambientLight
          intensity={1.5}
        />


        <directionalLight
          position={[5, 5, 5]}
          intensity={2}
        />


        <directionalLight
          position={[-5, 3, 2]}
          intensity={1}
        />


        {/* ==========================================
            DRAGON
            ========================================== */}

        <Suspense fallback={null}>

          <GLBModel />

        </Suspense>

      </Canvas>

    </View>
  );
}


// ====================================================
// PRELOAD MODEL
// ====================================================

useGLTF.preload(MODEL_PATH);


// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({

  container: {

    width: "100%",

    height: "100%",

    minHeight: 200,

    position: "relative",

    backgroundColor: "transparent",
  },

});