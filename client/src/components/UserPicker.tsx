import { useApp } from '../context/AppContext';
import './UserPicker.css';

export default function UserPicker() {
  const { users, usersLoading, usersError, setCurrentUser } = useApp();

  if (usersLoading) {
    return (
      <div className="user-picker">
        <div className="user-picker-state">Loading users...</div>
      </div>
    );
  }

  if (usersError) {
    return (
      <div className="user-picker">
        <div className="user-picker-state">Failed to load users.</div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="user-picker">
        <div className="user-picker-state">No users available.</div>
      </div>
    );
  }

  return (
    <div className="user-picker">
      <h1 className="user-picker-title">Who are you?</h1>
      <p className="user-picker-subtitle">Select a user to start chatting</p>
      <div className="user-picker-grid">
        {users.map((user) => (
          <button
            key={user.id}
            className="user-card"
            onClick={() => setCurrentUser(user)}
          >
            <img className="user-card-avatar" src={user.avatarUrl} alt={user.displayName} />
            <span className="user-card-name">{user.displayName}</span>
            <span className="user-card-title">{user.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
