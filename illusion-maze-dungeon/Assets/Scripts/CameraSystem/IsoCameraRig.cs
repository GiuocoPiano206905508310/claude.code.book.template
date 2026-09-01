using UnityEngine;

namespace IllusionMaze.CameraSystem
{
    /// <summary>
    /// Orbits the camera around a focus point (the hero) in fixed 90-degree
    /// steps, giving the four cardinal viewing angles onto the dungeon
    /// described in the design doc. Call <see cref="RotateClockwise"/> /
    /// <see cref="RotateCounterClockwise"/> from a UI button or a debug key
    /// binding -- the design doc does not reserve a keyboard key for this, since
    /// on mobile it is expected to be a screen button.
    /// </summary>
    public sealed class IsoCameraRig : MonoBehaviour
    {
        [Header("Framing")]
        [SerializeField] private Transform focus;
        [SerializeField] private float distance = 12f;
        [SerializeField] private float height = 9f;
        [SerializeField] private float pitchDegrees = 35f;

        [Header("Rotation")]
        [SerializeField] private float rotateDuration = 0.35f;

        private float currentYaw;
        private float rotateStartYaw;
        private float targetYaw;
        private float rotateElapsed;
        private bool isRotating;

        public bool IsRotating => isRotating;

        private void LateUpdate()
        {
            if (focus == null) return;

            if (isRotating)
            {
                rotateElapsed += Time.deltaTime;
                float t = Mathf.Clamp01(rotateElapsed / rotateDuration);
                currentYaw = Mathf.LerpAngle(rotateStartYaw, targetYaw, Mathf.SmoothStep(0f, 1f, t));
                if (t >= 1f)
                {
                    currentYaw = targetYaw;
                    isRotating = false;
                }
            }

            Quaternion rotation = Quaternion.Euler(pitchDegrees, currentYaw, 0f);
            Vector3 offset = rotation * new Vector3(0f, 0f, -distance);
            transform.position = focus.position + offset + Vector3.up * height;
            transform.rotation = Quaternion.LookRotation(focus.position - transform.position, Vector3.up);
        }

        public void RotateClockwise() => BeginRotate(90f);
        public void RotateCounterClockwise() => BeginRotate(-90f);

        private void BeginRotate(float deltaDegrees)
        {
            if (isRotating) return;
            rotateStartYaw = currentYaw;
            targetYaw = currentYaw + deltaDegrees;
            rotateElapsed = 0f;
            isRotating = true;
        }
    }
}
