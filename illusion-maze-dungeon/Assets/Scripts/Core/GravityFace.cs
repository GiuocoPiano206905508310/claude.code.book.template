using UnityEngine;

namespace IllusionMaze.Core
{
    /// <summary>
    /// Which world-space surface the hero currently treats as "down". Reversal
    /// floors and reversal ladders change this to move the walkable plane from
    /// the ground onto a wall or the ceiling.
    /// </summary>
    public enum GravityFace
    {
        Floor,
        Ceiling,
        WallNorth,
        WallSouth,
        WallEast,
        WallWest
    }

    public static class GravityFaceExtensions
    {
        /// <summary>World-space direction that is "down" for this face.</summary>
        public static Vector3 DownDirection(this GravityFace face)
        {
            switch (face)
            {
                case GravityFace.Floor: return Vector3.down;
                case GravityFace.Ceiling: return Vector3.up;
                case GravityFace.WallNorth: return Vector3.forward;
                case GravityFace.WallSouth: return Vector3.back;
                case GravityFace.WallEast: return Vector3.right;
                case GravityFace.WallWest: return Vector3.left;
                default: return Vector3.down;
            }
        }

        /// <summary>
        /// Rotation that reorients "world up" to this face's up direction, so the
        /// hero visually stands upright on whichever surface is now the floor.
        /// </summary>
        public static Quaternion UprightRotation(this GravityFace face)
        {
            Vector3 up = -face.DownDirection();
            return Quaternion.FromToRotation(Vector3.up, up);
        }
    }
}
