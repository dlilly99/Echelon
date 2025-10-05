import tensorflow.compat.v1 as tf
import cv2
import time
import argparse
import numpy as np
import math
import posenet

tf.disable_v2_behavior()

parser = argparse.ArgumentParser()
parser.add_argument('--tolerance', type=int, default=30, help='The tolerance for the model in integers')
parser.add_argument('--model', type=int, default=101, help='The model to use, available versions are 101 (def.), 102, 103 etc')
parser.add_argument('--cam_id', type=int, default=0, help='The respective cam id to use (default 0)')
parser.add_argument('--cam_width', type=int, default=1280, help='The width of the webcam in pixels (def. 1280)')
parser.add_argument('--cam_height', type=int, default=720, help='The height of the webcam in pixels (def. 780)')
parser.add_argument('--scale_factor', type=float, default=0.7125, help='The scale factor to use (default: .7125)')
parser.add_argument('--file', type=str, default=None, help="Use the video file at specified path instead of live cam")
args = parser.parse_args()

keyValues = ['Nose', 'Left eye', 'Right eye', 'Left ear', 'Right ear', 'Left shoulder',
             'Right shoulder', 'Left elbow', 'Right elbow', 'Left wrist', 'Right wrist',
             'Left hip', 'Right hip', 'Left knee', 'Right knee', 'Left ankle', 'Right ankle']
tolerance = args.tolerance


    
def countRepetition(previous_pose, current_pose, previous_state, flag):
    # If keypoints not detected, skip
    if current_pose[0][10][0] == 0 and current_pose[0][10][1] == 0:
        return 'Cannot detect any joint in the frame', previous_pose, previous_state, flag

    # Define key joints for right arm (PoseNet keypoints)
    shoulder = current_pose[0][6]  # right shoulder
    elbow = current_pose[0][8]     # right elbow
    wrist = current_pose[0][10]    # right wrist

    # Compute elbow angle
    angle = calculate_angle(shoulder, elbow, wrist)
    string = f'Elbow Angle: {angle:.1f}\n'

    # Movement phase tracking
    current_state = previous_state.copy()
    if angle > 150:
        current_state[0] = "down"
    elif angle < 40:
        current_state[0] = "up"

    # Rep counting logic
    if previous_state[0] == "down" and current_state[0] == "up":
        flag += 1  # rep completed

    return string, current_pose, current_state.copy(), flag
    
def calculate_angle(a, b, c):
    """Calculates angle between three points (in degrees)."""
    a = np.array(a)  # Shoulder
    b = np.array(b)  # Elbow
    c = np.array(c)  # Wrist

    ba = a - b
    bc = c - b

    cosine_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    angle = np.degrees(np.arccos(np.clip(cosine_angle, -1.0, 1.0)))
    return angle

def main():
    with tf.Session() as sess:
        # Load the models
        model_cfg, model_outputs = posenet.load_model(args.model, sess)
        output_stride = model_cfg['output_stride']

        if args.file is not None: # Frame source, speicifed file or the specified(or default) live cam
            cap = cv2.VideoCapture(args.file)
        else:
            cap = cv2.VideoCapture(args.cam_id)
        cap.set(3, args.cam_width)
        cap.set(4, args.cam_height)
        cap.set(cv2.CAP_PROP_FPS, 60)
        previous_pose = '' # '' denotes it is empty, really fast checking!
        count = 0 # Stores the count of repetitions
        # A flag denoting change in state. 0 -> previous state is continuing, 1 -> state has changed
        flag = -1
        # Novel string stores a pair of bits for each of the 12 joints denoting whether the joint is moving up or down
        # when plotted in a graph against time, 1 denotes upward and 0 denotes downward curving of the graph. It is initialised
        # as '22' so that current_state wont ever be equal to the string we generate unless there is no movement out of tolerance
        current_state = [2,2]
        while True:
            # Get a frame, and get the model's prediction
            input_image, display_image, output_scale = posenet.read_cap(
                cap, scale_factor=args.scale_factor, output_stride=output_stride)
            heatmaps_result, offsets_result, displacement_fwd_result, displacement_bwd_result = sess.run(
                model_outputs,
                feed_dict={'image:0': input_image}
            )
            pose_scores, keypoint_scores, keypoint_coords = posenet.decode_multi.decode_multiple_poses(
                heatmaps_result.squeeze(axis=0),
                offsets_result.squeeze(axis=0),
                displacement_fwd_result.squeeze(axis=0),
                displacement_bwd_result.squeeze(axis=0),
                output_stride=output_stride,
                max_pose_detections=10,
                min_pose_score=0.4)
            keypoint_coords *= output_scale # Normalising the output against the resolution

            if(isinstance(previous_pose, str)): # if previous_pose was not inialised, assign the current keypoints to it
                previous_pose = keypoint_coords
            
            text, previous_pose, current_state, flag = countRepetition(previous_pose, keypoint_coords, current_state, flag)

            if(flag == 1):
                count += 1
                flag = -1

            image = posenet.draw_skel_and_kp(
                display_image, pose_scores, keypoint_scores, keypoint_coords,
                min_pose_score=0.4, min_part_score=0.1)

            # OpenCV does not recognise the use of \n delimeter
            y0, dy = 20, 20
            for i, line in enumerate(text.split('\n')):
                y = y0 + i*dy
                image = cv2.putText(image, line, (10, y), cv2.FONT_HERSHEY_SIMPLEX, .5, (255,255,255),1)

            image = cv2.putText(image, 'Count: ' + str(count), (10, y+20), cv2.FONT_HERSHEY_SIMPLEX, .5, (255,0,0),2)
            cv2.imshow('RepCounter', image)

            ch = cv2.waitKey(1)
            if(ch == ord('q') or ch == ord('Q')):
                break # Exit the loop on press of q or Q
            elif(ch == ord('r') or ch == ord('R')):
                count = 0
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
