import React, { useState, useEffect, useRef } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";
import * as bodyPix from "@tensorflow-models/body-pix";
import * as tf from "@tensorflow/tfjs";
import { NonMaxSuppressionV3 } from "@tensorflow/tfjs";

var rtc = {
  // For the local client.
  client: null,
  // For the local audio and video tracks.
  localAudioTrack: null,
  localVideoTrack: null,
};

var options = {
  // Pass your app ID here.
  appId: "5c05b2255e0f49588d1d522f3de922a1",
  // Set the channel name.
  channel: "testing",
  // Pass a token if your project enables the App Certificate.
  token:
    "0065c05b2255e0f49588d1d522f3de922a1IADGYexXSHr+Pn2HqlhpOMzIx7MLNwFtGBxY0Bn5z/j0GgZa8+gAAAAAEAA7EFxEKQGqYAEAAQAoAapg",
};

const Index = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [net, setNet] = useState(null);

  useEffect(() => {
    // Initalize agora engine
    rtc.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

    remoteUserPublish();

    const joinChannel = async () => {
      const uid = await rtc.client.join(
        options.appId,
        options.channel,
        options.token,
        null
      );
      localTrack(uid, net);
    };
    joinChannel();
  }, []);

  const drawBody = (personSegmentation, destCtx) => {
    // destCtx.drawImage(
    //     videoRef.current,
    //     0,
    //     0,
    //     1000,
    //     1000
    //   );
    // var imageData = destCtx.getImageData(0, 0, 1000,
    //     1000);
    // var pixel = imageData.data;
    // for (var p = 0; p < pixel.length; p += 4) {
    //   if (personSegmentation.data[p / 4] == 0) {
    //     pixel[p + 3] = 0;
    //   }
    // }
    // destCtx.imageSmoothingEnabled = true;
    // destCtx.putImageData(imageData, 0, 0);
  };

  const virtual = async (video, net) => {
    var canvas = document.querySelector("#canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.transform = "rotateY(180deg)";
    canvas.style.backgroundImage = `url(${"https://helpx.adobe.com/content/dam/help/en/photoshop/using/convert-color-image-black-white/jcr_content/main-pars/before_and_after/image-before/Landscape-Color.jpg"})`;
    canvas.style.backgroundSize = "contain";

    let destCtx = canvas.getContext("2d");

    // to remove background, need another canvas

    var canvasBg = document.querySelector("#bgCanvas");
    canvasBg.width = 600;
    canvasBg.height = 500;
    const tempCtx = canvasBg.getContext("2d");

    (async function loop() {
      requestAnimationFrame(loop);

      // create mask on temp canvas
      const personSegmentation = await net.segmentPerson(video, {
        flipHorizontal: false,
        internalResolution: "low",
        segmentationThreshold: 0.3,
      });

      const mask = bodyPix.toMask(personSegmentation);
      tempCtx.putImageData(mask, 0, 0);

      // draw original
      destCtx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      // then overwrap, masked area will be removed
      destCtx.save();
      destCtx.globalCompositeOperation = "destination-out";

      destCtx.drawImage(canvasBg, 0, 0, canvas.width, canvas.height);

      destCtx.restore();

      // drawBody(segmentation, destCtx)
    })();
  };

  const localTrack = async (uid, net) => {
    rtc.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

    // rtc.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    const videoMediaStreamTrack = await navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadeddata = () => {
          if (net == null) {
            bodyPix
              .load({
                architecture: "MobileNetV1",
                outputStride: 16,
                multiplier: 0.75,
                quantBytes: 2,
              })
              .catch((error) => {
                console.log(error);
              })
              .then((objNet) => {
                setNet(objNet);
                virtual(videoRef.current, objNet);
              });
          }
        };
        return canvasRef.current.captureStream(10).getVideoTracks()[0];
      })
      .catch((error) => {
        console.log(error);
      });

    console.log("videoRef", videoRef.current.srcObject.getVideoTracks()[0]);
    rtc.localVideoTrack = AgoraRTC.createCustomVideoTrack({
      mediaStreamTrack: videoMediaStreamTrack,
    });

    console.log("rtc.localVideoTrack", rtc.localVideoTrack);

    await rtc.client.publish([rtc.localAudioTrack, rtc.localVideoTrack]);
    console.log("publish success!");
  };

  const remoteUserPublish = () => {
    rtc.client.on("user-published", async (user, mediaType) => {
      // Subscribe to a remote user.
      await rtc.client.subscribe(user, mediaType);
      console.log("subscribe success");

      // If the subscribed track is video.
      if (mediaType === "video") {
        // Get `RemoteVideoTrack` in the `user` object.
        const remoteVideoTrack = user.videoTrack;
        // Dynamically create a container in the form of a DIV element for playing the remote video track.
        const playerContainer = document.createElement("div");
        // Specify the ID of the DIV container. You can use the `uid` of the remote user.
        playerContainer.id = user.uid.toString();
        playerContainer.style.width = "300px";
        playerContainer.style.height = "300px";
        document.body.append(playerContainer);

        // Play the remote video track.
        // Pass the DIV container and the SDK dynamically creates a player in the container for playing the remote video track.
        remoteVideoTrack.play(playerContainer);

        // Or just pass the ID of the DIV container.
        // remoteVideoTrack.play(playerContainer.id);
      }

      // If the subscribed track is audio.
      if (mediaType === "audio") {
        // Get `RemoteAudioTrack` in the `user` object.
        const remoteAudioTrack = user.audioTrack;
        // Play the audio track. No need to pass any DOM element.
        remoteAudioTrack.play();
      }
    });

    rtc.client.on("user-unpublished", (user) => {
      // Get the dynamically created DIV container.
      const playerContainer = document.getElementById(user.uid);
      // Destroy the container.
      console.log("user.uid", user.uid);
      if (user.uid) playerContainer && playerContainer.remove();
    });
  };

  const triggerLeaveCall = async () => {
    // Destroy the local audio and video tracks.
    rtc.localAudioTrack.close();
    rtc.localVideoTrack.close();

    // Traverse all remote users.
    rtc.client.remoteUsers.forEach((user) => {
      // Destroy the dynamically created DIV container.
      const playerContainer = document.getElementById(user.uid);
      playerContainer && playerContainer.remove();
    });

    // Leave the channel.
    await rtc.client.leave();
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        id="bodyCam"
        ref={videoRef}
        autoPlay
        style={{ display: "none", width: "100%", height: "100%" }}
      ></video>
      <canvas width={1000} height={800} id="canvas" ref={canvasRef}></canvas>

      <canvas id="bgCanvas" style={{position: 'absolute', left:'0px', right: '0px', zIndex: '-1', width: '0px', height: '0px'}}></canvas>
      {/* <button
        style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          background: "red",
          color: "#000",
          padding: "6px 12px",
          zIndex: "100",
        }}
        onClick={() => VirtualBackground()}
      >
        Virtual
      </button> */}

      {/* <button
        style={{
          position: "absolute",
          top: "20px",
          left: "50%",
          background: "#fff",
          color: "#000",
          padding: "6px 12px",
          zIndex: "100",
        }}
        onClick={() => triggerLeaveCall()}
      >
        Leave call
      </button> */}
    </div>
  );
};

export default Index;
