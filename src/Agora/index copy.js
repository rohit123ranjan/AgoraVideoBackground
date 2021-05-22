import React, { useEffect } from "react";
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
      localTrack(uid);
    };
    joinChannel();
  }, []);

  const drawBody = (video, segmentation) => {
    const canvas = document.getElementById('canvas');

    video.width = canvas.width = video.videoWidth;
    video.height = canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    canvas.style.backgroundImage = `url(${"https://helpx.adobe.com/content/dam/help/en/photoshop/using/convert-color-image-black-white/jcr_content/main-pars/before_and_after/image-before/Landscape-Color.jpg"})`;
    canvas.style.backgroundSize = "contain";

    ctx.drawImage(video, 0, 0, 1000, 800);
    var imageData= ctx.getImageData(0,0,1000, 800);

    var pixel = imageData.data;
    for (var p = 0; p<pixel.length; p+=4)
    {
        if (segmentation.data[p/4] == 0) {
            pixel[p+3] = 0;
        }
    }
    ctx.imageSmoothingEnabled = true;
    ctx.putImageData(imageData,0,0);
  };

  const virtual = async() => {
      const net = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2
      });

      const videoData = document.getElementById(String(rtc.localVideoTrack?._player?.videoElement.attributes?.id?.value));
      console.log("data", videoData)

      const personSegmentation = await net.segmentPerson(videoData, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.7
      });
      console.log("personSegmentation",personSegmentation)
      if(personSegmentation!=null){
        drawBody(videoData, personSegmentation);
      }
  };

  const localTrack = async (uid) => {
    rtc.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

    // rtc.localVideoTrack = await AgoraRTC.createCameraVideoTrack();

    rtc.localVideoTrack = await navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        const videoMediaStreamTrack = mediaStream.getVideoTracks()[0];
        return AgoraRTC.createCustomVideoTrack({
          mediaStreamTrack: videoMediaStreamTrack,
        });
      });

    const videoSection = document.querySelector("#videoSection");
    const section = document.createElement("section");

    section.id = uid;
    section.style.width = "100%";
    section.style.height = "100%";
    section.style.position = "absolute";

    videoSection.append(section);

    // videoSection.append(section);
    rtc.localVideoTrack.play(section);

    // detecting parent of video
    const videoParent = document.getElementById(String(rtc.localVideoTrack?._player?.container?.id));
    const videoData = document.getElementById(String(rtc.localVideoTrack?._player?.videoElement.attributes?.id?.value));
    videoData.style.display = 'none';
    let videoCanvas = document.createElement('canvas');
    videoCanvas.id = "videoCanvas";
    videoCanvas.style.width = '100%';
    videoCanvas.style.height = '100%';
    videoCanvas.style.transform = 'rotateY(180deg)';
    videoCanvas.style.backgroundImage = `url(${"https://helpx.adobe.com/content/dam/help/en/photoshop/using/convert-color-image-black-white/jcr_content/main-pars/before_and_after/image-before/Landscape-Color.jpg"})`;
    videoCanvas.style.backgroundSize = "contain";
    const ctx = videoCanvas.getContext("2d");

    videoParent.append(videoCanvas);

    // Create another canvas to remove background
    let bgCanvas = document.createElement('canvas');
    bgCanvas.id = "bgCanvas";
    bgCanvas.style.width = '100%';
    bgCanvas.style.height = '100%';
    bgCanvas.style.transform = 'rotateY(180deg)';
    const bgCtx = bgCanvas.getContext("2d");

    videoParent.append(bgCanvas);

    videoData.addEventListener('play', () => {
      async function step() {
        
        const net = await bodyPix.load({
          architecture: 'MobileNetV1',
          outputStride: 16,
          multiplier: 0.75,
          quantBytes: 2
        });

        const personSegmentation = await net.segmentPerson(videoData, {
          flipHorizontal: false,
          internalResolution: 'medium',
          segmentationThreshold: 0.7
        });

        if(personSegmentation!=null){
          const mask = bodyPix.toMask(personSegmentation);
          bgCtx.putImageData(mask, 0, 0);
        }
        ctx.drawImage(videoData, 0, 0, videoCanvas.width, videoCanvas.height)
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";

        ctx.drawImage(bgCanvas, 0, 0, videoCanvas.width, videoCanvas.height)

        ctx.restore();

        requestAnimationFrame(step)
      }
      requestAnimationFrame(step);
    })

    // virtual();

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
    <>
      <button
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
      </button>
      <div
        id="videoSection"
        style={{
          width: "100%",
          height: "100%",
        }}
      ></div>
    </>
  );
};

export default Index;
