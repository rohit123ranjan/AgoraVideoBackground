import React, { useEffect } from "react";
import AgoraRTC from "agora-rtc-sdk-ng";

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
  token: "0065c05b2255e0f49588d1d522f3de922a1IABVPuBs2RxI2AwA01DXUOAx2DWqbNYYEeHcItlIxeZTwwZa8+gAAAAAEAA7EFxEwJ2oYAEAAQC/nahg",
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

  const localTrack = async (uid) => {
    // Create an audio track from the audio sampled by a microphone.
    rtc.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    // Create a video track from the video captured by a camera.
    rtc.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    // Publish the local audio and video tracks to the channel.
    await rtc.client.publish([rtc.localAudioTrack, rtc.localVideoTrack]);
    console.log("publish success!");

    const canvas = document.querySelector('#canvas');
    const section = document.createElement("section");

    section.id = uid;
    section.style.width = "100%";
    section.style.height = "100%";
    section.style.position = 'absolute';

    canvas.append(section);
    rtc.localVideoTrack.play(section);
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
      console.log("user.uid",user.uid)
      if(user.uid)
      playerContainer && playerContainer.remove();
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
          zIndex: '100'
        }}
        onClick={() => triggerLeaveCall()}
      >
        Leave call
      </button>
      <div id="canvas" style={{
        width: '100%',
        height: '100%'
      }}>

      </div>
    </>
  );
};

export default Index;
