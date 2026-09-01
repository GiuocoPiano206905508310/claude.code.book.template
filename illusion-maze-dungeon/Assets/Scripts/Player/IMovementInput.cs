using UnityEngine;

namespace IllusionMaze.Player
{
    /// <summary>
    /// Movement and action input for the hero, decoupled from the input device
    /// so PC keyboard and mobile touch controls can share the same
    /// <see cref="PlayerController"/>.
    /// </summary>
    public interface IMovementInput
    {
        /// <summary>Raw move axis in the range [-1, 1] on each component.</summary>
        Vector2 MoveAxis { get; }

        /// <summary>True on the frame the "examine" action is pressed.</summary>
        bool ExamineTriggered { get; }

        /// <summary>True on the frame the "use potion" action is pressed.</summary>
        bool UsePotionTriggered { get; }

        /// <summary>True on the frame the "use shield" action is pressed.</summary>
        bool UseShieldTriggered { get; }
    }
}
