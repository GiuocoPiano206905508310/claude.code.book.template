using UnityEngine;

namespace IllusionMaze.Player
{
    /// <summary>
    /// Bridges <see cref="PlayerController"/> state changes to an Animator, so
    /// movement logic stays free of animation-specific code. Expects an
    /// Animator with a "State" integer parameter whose values match
    /// <see cref="PlayerState"/>'s declaration order.
    /// </summary>
    [RequireComponent(typeof(PlayerController))]
    public sealed class PlayerAnimatorLink : MonoBehaviour
    {
        [SerializeField] private Animator animator;

        private static readonly int StateParam = Animator.StringToHash("State");

        private PlayerController controller;

        private void Awake()
        {
            controller = GetComponent<PlayerController>();
            if (animator == null) animator = GetComponentInChildren<Animator>();
        }

        private void OnEnable() => controller.StateChanged += HandleStateChanged;
        private void OnDisable() => controller.StateChanged -= HandleStateChanged;

        private void HandleStateChanged(PlayerState state)
        {
            if (animator == null) return;
            animator.SetInteger(StateParam, (int)state);
        }
    }
}
