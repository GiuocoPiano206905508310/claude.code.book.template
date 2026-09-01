using System;
using System.Collections;
using UnityEngine;
using IllusionMaze.Core;

namespace IllusionMaze.Player
{
    /// <summary>Animation-facing state, matching the design doc's animation list.</summary>
    public enum PlayerState
    {
        Idle,
        Moving,
        Attacking,
        Guarding,
        GravityShifting,
        Damaged
    }

    /// <summary>
    /// Moves the hero across whichever surface is currently "down" (see
    /// <see cref="GravityFace"/>), reading input relative to the active camera
    /// so on-screen up/down/left/right always match the player's key presses --
    /// including while walking on a wall or the ceiling. Gimmicks such as the
    /// reversal floor call <see cref="SetGravityFace"/> to move the hero onto a
    /// new surface.
    /// </summary>
    public sealed class PlayerController : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField] private float moveSpeed = 3.5f;
        [SerializeField] private float turnSpeedDegreesPerSecond = 720f;
        [SerializeField] private float gravityShiftDuration = 0.5f;

        [Header("Surface snapping")]
        [SerializeField] private LayerMask groundMask = ~0;
        [SerializeField] private float snapRayDistance = 1.5f;
        [SerializeField] private float surfaceOffset = 0.02f;

        [Header("References")]
        [SerializeField] private Transform cameraRig;
        [Tooltip("A component implementing IMovementInput (e.g. KeyboardMovementInput).")]
        [SerializeField] private MonoBehaviour inputSource;

        private IMovementInput input;
        private GravityFace currentFace = GravityFace.Floor;
        private PlayerState state = PlayerState.Idle;
        private bool isShiftingGravity;

        public event Action<PlayerState> StateChanged;
        public GravityFace CurrentFace => currentFace;
        public PlayerState State => state;

        private void Awake()
        {
            input = inputSource as IMovementInput;
            if (input == null)
            {
                Debug.LogError(
                    $"{nameof(PlayerController)} needs a component implementing {nameof(IMovementInput)} assigned to '{nameof(inputSource)}'.",
                    this);
            }
        }

        private void Update()
        {
            if (input == null || isShiftingGravity) return;

            Vector3 moveDirection = CameraRelativeMoveDirection();
            bool isMoving = moveDirection.sqrMagnitude > 0.0001f;

            if (isMoving)
            {
                transform.position += moveDirection * moveSpeed * Time.deltaTime;
                RotateTowards(moveDirection);
            }

            SnapToSurface();
            SetState(isMoving ? PlayerState.Moving : PlayerState.Idle);
        }

        /// <summary>
        /// Projects the raw move axis onto the current gravity plane using the
        /// camera's flattened forward/right, so input reads correctly relative
        /// to what is on screen no matter which face the hero is standing on.
        /// </summary>
        private Vector3 CameraRelativeMoveDirection()
        {
            Vector3 planeUp = -currentFace.DownDirection();
            Vector3 camForward = cameraRig != null ? cameraRig.forward : Vector3.forward;
            Vector3 camRight = cameraRig != null ? cameraRig.right : Vector3.right;

            Vector3 forward = Vector3.ProjectOnPlane(camForward, planeUp).normalized;
            Vector3 right = Vector3.ProjectOnPlane(camRight, planeUp).normalized;

            Vector2 axis = input.MoveAxis;
            return forward * axis.y + right * axis.x;
        }

        private void RotateTowards(Vector3 direction)
        {
            Quaternion target = Quaternion.LookRotation(direction, transform.up);
            transform.rotation = Quaternion.RotateTowards(transform.rotation, target, turnSpeedDegreesPerSecond * Time.deltaTime);
        }

        /// <summary>
        /// Keeps the hero resting on the current surface by raycasting along the
        /// active gravity direction. Levels built from the block-based dungeon
        /// pieces only need a collider on their walkable faces for this to work.
        /// </summary>
        private void SnapToSurface()
        {
            Vector3 down = currentFace.DownDirection();
            Vector3 rayOrigin = transform.position - down * 0.1f;
            if (Physics.Raycast(rayOrigin, down, out RaycastHit hit, snapRayDistance, groundMask))
            {
                transform.position = hit.point - down * surfaceOffset;
            }
        }

        /// <summary>
        /// Called by reversal-floor and reversal-ladder gimmicks to move the
        /// hero onto a new walkable face (a wall, the ceiling, or back to the
        /// floor), with a short upright transition rather than an instant snap.
        /// </summary>
        public void SetGravityFace(GravityFace face)
        {
            if (face == currentFace || isShiftingGravity) return;
            StartCoroutine(ShiftGravity(face));
        }

        private IEnumerator ShiftGravity(GravityFace face)
        {
            isShiftingGravity = true;
            SetState(PlayerState.GravityShifting);

            Quaternion startRotation = transform.rotation;
            Quaternion targetUpright = face.UprightRotation();
            float elapsed = 0f;

            while (elapsed < gravityShiftDuration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.SmoothStep(0f, 1f, elapsed / gravityShiftDuration);
                transform.rotation = Quaternion.Slerp(startRotation, targetUpright, t);
                yield return null;
            }

            transform.rotation = targetUpright;
            currentFace = face;
            isShiftingGravity = false;
            SetState(PlayerState.Idle);
        }

        public void TriggerAttack() => SetState(PlayerState.Attacking);
        public void TriggerGuard() => SetState(PlayerState.Guarding);
        public void TriggerDamage() => SetState(PlayerState.Damaged);

        private void SetState(PlayerState next)
        {
            if (state == next) return;
            state = next;
            StateChanged?.Invoke(state);
        }
    }
}
