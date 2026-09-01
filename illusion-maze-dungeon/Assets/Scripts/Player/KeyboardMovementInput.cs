using UnityEngine;

namespace IllusionMaze.Player
{
    /// <summary>
    /// PC keyboard implementation of <see cref="IMovementInput"/>: arrow keys or
    /// WASD to move, E to examine, Q for the potion, R for the shield -- matching
    /// the design doc's PC key map. Unity's default Horizontal/Vertical axes
    /// already bind both WASD and the arrow keys, so no custom Input Manager
    /// setup is required.
    /// </summary>
    public sealed class KeyboardMovementInput : MonoBehaviour, IMovementInput
    {
        public Vector2 MoveAxis => new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        public bool ExamineTriggered => Input.GetKeyDown(KeyCode.E);
        public bool UsePotionTriggered => Input.GetKeyDown(KeyCode.Q);
        public bool UseShieldTriggered => Input.GetKeyDown(KeyCode.R);
    }
}
