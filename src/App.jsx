import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from 'firebase/auth';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    onSnapshot,
    orderBy,
    serverTimestamp,
    deleteDoc,
    query,
    updateDoc,
    limit,
    where
} from 'firebase/firestore';
import {
    ref,
    uploadBytes,
    getDownloadURL
} from 'firebase/storage';
import { auth, db, storage } from './firebase';
import {
    ChevronLeft,
    Send,
    Search,
    User,
    Check,
    CheckCheck,
    X,
    Loader2,
    LogOut,
    Camera,
    Image as ImageIcon,
    MoreVertical,
    Trash2,
    Users,
    Plus,
    Edit2,
    UserMinus,
    Settings,
    Sun,
    Moon
} from 'lucide-react';

const Input = ({ value, onChange, placeholder, type = "text", className = "" }) => (
    <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors ${className}`}
    />
);

const Button = ({ children, onClick, disabled, variant = "primary", className = "" }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`w-full font-medium py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variant === "primary"
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-gray-800 hover:bg-gray-700 text-white"
            } ${className}`}
    >
        {children}
    </button>
);

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black flex items-center justify-center p-4">
                    <div className="text-center text-white">
                        <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
                        <p className="text-gray-400 mb-4 text-sm">Please refresh the page</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-blue-600 rounded-lg text-sm"
                        >
                            Refresh
                        </button>
                        <pre className="mt-4 text-xs text-red-400 bg-gray-900 p-2 rounded overflow-auto max-w-xs mx-auto text-left">
                            {this.state.error?.toString()}
                        </pre>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function App() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('auth');
    const [activeChat, setActiveChat] = useState(null);
    const [friends, setFriends] = useState([]);
    const [chatsData, setChatsData] = useState({});
    const [groupChatsData, setGroupChatsData] = useState({});
    const [friendProfiles, setFriendProfiles] = useState({});
    const [groups, setGroups] = useState([]);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            return saved ? saved === 'dark' : true;
        }
        return true;
    });

    const toggleTheme = () => {
        setIsDarkMode(prev => {
            const newTheme = !prev;
            localStorage.setItem('theme', newTheme ? 'dark' : 'light');
            return newTheme;
        });
    };


    useEffect(() => {
        setPersistence(auth, browserLocalPersistence).catch(console.error);
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const docRef = doc(db, 'users', currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setProfile(docSnap.data());
                        if (!docSnap.data().displayName) {
                            setView('profile');
                        } else {
                            setView('conversations');
                        }
                    } else {
                        setView('profile');
                    }
                } catch (err) {
                    console.error("Firestore Error:", err);
                }
            } else {
                setUser(null);
                setProfile(null);
                setView('auth');
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'users', user.uid, 'friends'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setFriends(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return unsubscribe;
    }, [user]);

    // Fetch friend profiles
    useEffect(() => {
        const unsubscribes = friends.map(friend => {
            const friendDocRef = doc(db, 'users', friend.uid);
            return onSnapshot(friendDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setFriendProfiles(prev => ({
                        ...prev,
                        [friend.uid]: docSnap.data()
                    }));
                }
            });
        });
        return () => unsubscribes.forEach(unsub => unsub());
    }, [friends]);

    // Fetch groups
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'groups'), where('members', 'array-contains', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'group' })));
        });
        return unsubscribe;
    }, [user]);

    // Fetch chat data (last message, unread count)
    useEffect(() => {
        if (!user || !friends.length) return;

        const unsubscribes = friends.map(friend => {
            const chatId = [user.uid, friend.uid].sort().join('_');
            const q = query(
                collection(db, 'chats', chatId, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(20)
            );

            return onSnapshot(q, (snapshot) => {
                const messages = snapshot.docs.map(doc => doc.data());
                const lastMsg = messages[0];
                const unreadCount = messages.filter(m => !m.seen && m.senderId === friend.uid).length;

                setChatsData(prev => ({
                    ...prev,
                    [friend.uid]: {
                        lastMessage: lastMsg,
                        unreadCount: unreadCount
                    }
                }));
            });
        });
        return () => unsubscribes.forEach(unsub => unsub());
    }, [friends, user]);

    // Fetch group chat data
    useEffect(() => {
        if (!user || !groups.length) return;

        const unsubscribes = groups.map(group => {
            const q = query(
                collection(db, 'groups', group.id, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(20)
            );

            return onSnapshot(q, (snapshot) => {
                const messages = snapshot.docs.map(doc => doc.data());
                const lastMsg = messages[0];
                const unreadCount = messages.filter(m => !m.seen && m.senderId !== user.uid).length;

                setGroupChatsData(prev => ({
                    ...prev,
                    [group.id]: {
                        lastMessage: lastMsg,
                        unreadCount: unreadCount
                    }
                }));
            });
        });
        return () => unsubscribes.forEach(unsub => unsub());
    }, [groups, user]);

    // Notification Listener
    useEffect(() => {
        if (!user || !friends.length) return;

        const unsubscribes = friends.map(friend => {
            const chatId = [user.uid, friend.uid].sort().join('_');
            const q = query(
                collection(db, 'chats', chatId, 'messages'),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            return onSnapshot(q, (snapshot) => {
                if (snapshot.empty) return;
                const message = snapshot.docs[0].data();

                // Check if message is new (within last 2 seconds to avoid spam on load)
                const isRecent = message.timestamp?.toMillis() > Date.now() - 2000;

                if (isRecent && message.senderId !== user.uid) {
                    // Check if we should notify
                    const isChatActive = activeChat?.uid === friend.uid && view === 'chat';
                    const isAppHidden = document.hidden;

                    if (!isChatActive || isAppHidden) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            try {
                                const notification = new Notification(`New message from ${friend.displayName}`, {
                                    body: message.text || (message.image ? 'Sent an image' : 'New message'),
                                    icon: '/vite.svg'
                                });
                                notification.onclick = () => {
                                    window.focus();
                                    setActiveChat(friend);
                                    setView('chat');
                                };
                            } catch (e) {
                                console.log("Notification creation error:", e);
                            }
                        }
                    }
                }
            });
        });

        return () => unsubscribes.forEach(unsub => unsub());
    }, [user, friends, activeChat, view]);

    const handleLogout = async () => {
        await signOut(auth);
        setView('auth');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (view === 'auth') {
        return (
            <ErrorBoundary>
                <Auth />
            </ErrorBoundary>
        );
    }

    if (view === 'profile') {
        return (
            <ErrorBoundary>
                <div className={isDarkMode ? 'dark' : ''}>
                    <ProfileSetup user={user} profile={profile} onSave={() => setView('conversations')} onBack={() => setView('conversations')} />
                </div>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <div className={isDarkMode ? 'dark' : ''}>
                <div className="h-screen bg-white dark:bg-black flex flex-col md:flex-row max-w-7xl mx-auto overflow-hidden transition-colors duration-200">
                    {(view === 'conversations' || window.innerWidth >= 768) && (
                        <div className={`${view === 'chat' && window.innerWidth < 768 ? 'hidden' : ''} md:w-96 w-full border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-black transition-colors duration-200`}>
                            <ConversationsList
                                friends={friends}
                                user={user}
                                profile={profile}
                                chatsData={chatsData}
                                groupChatsData={groupChatsData}
                                friendProfiles={friendProfiles}
                                groups={groups}
                                onSelectFriend={(friend) => {
                                    setActiveChat(friend);
                                    setView('chat');
                                }}
                                onOpenProfile={() => setView('profile')}
                                onLogout={handleLogout}
                                isDarkMode={isDarkMode}
                                toggleTheme={toggleTheme}
                            />
                        </div>
                    )}

                    {view === 'chat' && activeChat ? (
                        <ChatView
                            user={user}
                            profile={profile}
                            friend={activeChat}
                            onBack={() => {
                                setView('conversations');
                                setActiveChat(null);
                            }}
                        />
                    ) : (
                        <div className="hidden md:flex flex-1 items-center justify-center bg-black">
                            <div className="text-center text-gray-600">
                                <p className="text-lg">Select a conversation</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ErrorBoundary>
    );
}

function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const cred = await createUserWithEmailAndPassword(auth, email, password);
                await setDoc(doc(db, 'users', cred.user.uid), {
                    uid: cred.user.uid,
                    email: email,
                    createdAt: serverTimestamp()
                });
            }
        } catch (err) {
            setError(err.message.replace('Firebase: ', '').replace('Error (auth/', '').replace(')', ''));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">Chat App</h1>
                    <p className="text-gray-400">{isLogin ? 'Welcome back!' : 'Create your account'}</p>
                </div>

                <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleAuth} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                            />
                        </div>
                        <Button disabled={loading || !email || !password}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (isLogin ? 'Sign In' : 'Sign Up')}
                        </Button>
                    </form>

                    <div className="text-center">
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ProfileSetup({ user, profile, onSave, onBack }) {
    const [name, setName] = useState(profile?.displayName || '');
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(profile?.photoURL || null);
    const [saving, setSaving] = useState(false);
    const [editingName, setEditingName] = useState(!profile?.displayName);

    const [showAddFriend, setShowAddFriend] = useState(false);
    const fileInputRef = useRef(null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            let photoURL = profile?.photoURL || null;

            if (image) {
                const storageRef = ref(storage, `profiles/${user.uid}`);
                await uploadBytes(storageRef, image);
                photoURL = await getDownloadURL(storageRef);
            }

            await setDoc(doc(db, 'users', user.uid), {
                displayName: name,
                photoURL,
                searchCode: user.uid,
                lastSeen: serverTimestamp()
            }, { merge: true });

            setEditingName(false);
            onSave();
        } catch (error) {
            console.error("Error saving profile:", error);
        } finally {
            setSaving(false);
        }
    };



    if (showAddFriend) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4 transition-colors">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col h-[600px] transition-colors">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                        <button onClick={() => setShowAddFriend(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                            <ChevronLeft size={24} />
                        </button>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Friend</h2>
                    </div>
                    <div className="p-4 overflow-y-auto flex-1">
                        <FriendSearchCard user={user} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center p-4 transition-colors">
            <div className="w-full max-w-md space-y-6">
                {onBack && profile?.displayName && (
                    <button
                        onClick={onBack}
                        className="fixed top-0 left-0 p-3 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 z-50 m-4"
                    >
                        <ChevronLeft size={24} />
                    </button>
                )}
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Profile Setup</h1>
                    <p className="text-gray-500 dark:text-gray-400">Customize your profile</p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800 space-y-6 transition-colors">
                    <div className="flex flex-col items-center gap-4">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-800 cursor-pointer overflow-hidden group border-2 border-gray-300 dark:border-gray-700 hover:border-gray-500 transition-colors"
                        >
                            {preview ? (
                                <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <Camera size={32} />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Camera size={24} className="text-white" />
                            </div>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            accept="image/*"
                            className="hidden"
                        />
                        <p className="text-sm text-gray-500">Tap to {preview ? 'change' : 'add'} photo</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Display Name</label>
                        {editingName ? (
                            <div className="space-y-3">
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Enter your name"
                                    autoFocus
                                />
                                <div className="flex gap-2">
                                    <Button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1">
                                        {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save'}
                                    </Button>
                                    {profile?.displayName && (
                                        <button
                                            onClick={() => {
                                                setName(profile.displayName);
                                                setEditingName(false);
                                            }}
                                            className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-xl transition-colors">
                                <span className="text-gray-900 dark:text-white font-medium">{name}</span>
                                <button
                                    onClick={() => setEditingName(true)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Edit
                                </button>
                            </div>
                        )}
                    </div>


                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button
                            onClick={() => setShowAddFriend(true)}
                            className="w-full p-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl flex items-center justify-between group transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                                    <Plus size={20} />
                                </div>
                                <span className="text-gray-900 dark:text-white font-medium">Add New Friend</span>
                            </div>
                            <ChevronLeft size={20} className="text-gray-500 rotate-180" />
                        </button>
                    </div>

                    {!editingName && image && (
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Photo'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function CreateGroupModal({ user, friends, onClose }) {
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!groupName.trim() || selectedMembers.length === 0) return;
        setCreating(true);
        try {
            const groupRef = await addDoc(collection(db, 'groups'), {
                name: groupName.trim(),
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                members: [user.uid, ...selectedMembers],
                type: 'group',
                photoURL: null
            });
            onClose();
        } catch (err) {
            console.error("Error creating group:", err);
        } finally {
            setCreating(false);
        }
    };

    const toggleMember = (uid) => {
        if (selectedMembers.includes(uid)) {
            setSelectedMembers(prev => prev.filter(id => id !== uid));
        } else {
            setSelectedMembers(prev => [...prev, uid]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[80vh] transition-colors">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">New Group</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Group Name</label>
                        <Input
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Enter group name"
                            className="bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Select Members</label>
                        <div className="space-y-2">
                            {friends.map(friend => (
                                <div
                                    key={friend.uid}
                                    onClick={() => toggleMember(friend.uid)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedMembers.includes(friend.uid)
                                        ? 'bg-blue-600/20 border-blue-600'
                                        : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedMembers.includes(friend.uid)
                                        ? 'bg-blue-600 border-blue-600'
                                        : 'border-gray-400 dark:border-gray-500'
                                        }`}>
                                        {selectedMembers.includes(friend.uid) && <Check size={12} className="text-white" />}
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                        {friend.photoURL ? (
                                            <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-semibold text-xs">
                                                {friend.displayName?.[0]?.toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-gray-900 dark:text-white font-medium">{friend.displayName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                    <Button onClick={handleCreate} disabled={creating || !groupName.trim() || selectedMembers.length === 0}>
                        {creating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Group'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function GroupInfoModal({ group, user, profile, onClose, onLeave }) {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingName, setEditingName] = useState(false);
    const [newGroupName, setNewGroupName] = useState(group.name);
    const [showAddMember, setShowAddMember] = useState(false);
    const [allFriends, setAllFriends] = useState([]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const memberProfiles = await Promise.all(
                    group.members.map(async (uid) => {
                        const userDoc = await getDoc(doc(db, 'users', uid));
                        return { uid, ...userDoc.data() };
                    })
                );
                setMembers(memberProfiles);
            } catch (err) {
                console.error("Error fetching members:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchMembers();
    }, [group]);

    // Fetch user's friends for adding to group
    useEffect(() => {
        const fetchFriends = async () => {
            try {
                const friendsSnapshot = await getDocs(collection(db, 'users', user.uid, 'friends'));
                const friendsData = await Promise.all(
                    friendsSnapshot.docs.map(async (friendDoc) => {
                        const friendData = friendDoc.data();
                        return { uid: friendDoc.id, ...friendData };
                    })
                );
                setAllFriends(friendsData);
            } catch (err) {
                console.error("Error fetching friends:", err);
            }
        };
        fetchFriends();
    }, [user]);

    const handleRemoveMember = async (memberUid) => {
        if (group.createdBy !== user.uid) {
            alert("Only the admin can remove members");
            return;
        }

        if (memberUid === user.uid) {
            alert("You cannot remove yourself. Use 'Leave Group' instead.");
            return;
        }

        if (!window.confirm('Remove this member from the group?')) return;

        try {
            const memberName = members.find(m => m.uid === memberUid)?.displayName || 'Unknown';
            const updatedMembers = group.members.filter(uid => uid !== memberUid);
            await updateDoc(doc(db, 'groups', group.id), {
                members: updatedMembers
            });

            // Add system notification
            await addDoc(collection(db, 'groups', group.id, 'messages'), {
                type: 'system',
                text: `${profile?.displayName || 'Someone'} removed ${memberName}`,
                timestamp: serverTimestamp(),
                senderId: user.uid
            });
        } catch (err) {
            console.error("Error removing member:", err);
        }
    };;

    const handleAddMember = async (newMemberUid) => {
        if (group.members.includes(newMemberUid)) {
            alert("This person is already in the group");
            return;
        }

        try {
            const memberName = allFriends.find(f => f.uid === newMemberUid)?.displayName || 'Unknown';
            const updatedMembers = [...group.members, newMemberUid];
            await updateDoc(doc(db, 'groups', group.id), {
                members: updatedMembers
            });

            // Add system notification
            await addDoc(collection(db, 'groups', group.id, 'messages'), {
                type: 'system',
                text: `${profile?.displayName || 'Someone'} added ${memberName}`,
                timestamp: serverTimestamp(),
                senderId: user.uid
            });

            setShowAddMember(false);
        } catch (err) {
            console.error("Error adding member:", err);
        }
    };

    const handleUpdateGroupName = async () => {
        if (!newGroupName.trim()) return;
        if (newGroupName.trim() === group.name) {
            setEditingName(false);
            return;
        }

        try {
            await updateDoc(doc(db, 'groups', group.id), {
                name: newGroupName.trim()
            });

            // Add system notification
            await addDoc(collection(db, 'groups', group.id, 'messages'), {
                type: 'system',
                text: `${profile?.displayName || 'Someone'} changed the group name to "${newGroupName.trim()}"`,
                timestamp: serverTimestamp(),
                senderId: user.uid
            });

            setEditingName(false);
        } catch (err) {
            console.error("Error updating group name:", err);
        }
    };

    const handleLeaveGroup = async () => {
        if (!window.confirm('Are you sure you want to leave this group?')) return;
        try {
            const updatedMembers = group.members.filter(uid => uid !== user.uid);
            await updateDoc(doc(db, 'groups', group.id), {
                members: updatedMembers
            });

            // Add system notification
            await addDoc(collection(db, 'groups', group.id, 'messages'), {
                type: 'system',
                text: `${profile?.displayName || 'Someone'} left the group`,
                timestamp: serverTimestamp(),
                senderId: user.uid
            });

            onLeave();
        } catch (err) {
            console.error("Error leaving group:", err);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[80vh] transition-colors">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Group Info</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                    <div className="flex flex-col items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                        <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                            <Users size={32} className="text-gray-500 dark:text-gray-400" />
                        </div>
                        <div className="text-center w-full">
                            {editingName ? (
                                <div className="flex items-center gap-2 justify-center">
                                    <Input
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        className="text-sm max-w-xs"
                                        placeholder="Group name"
                                    />
                                    <button
                                        onClick={handleUpdateGroupName}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-xs font-medium"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingName(false);
                                            setNewGroupName(group.name);
                                        }}
                                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xs font-medium"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 justify-center">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</h3>
                                    <button
                                        onClick={() => setEditingName(true)}
                                        className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                </div>
                            )}
                            <p className="text-sm text-gray-500 dark:text-gray-400">{group.members?.length || 0} members</p>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Members</h4>
                            <button
                                onClick={() => setShowAddMember(!showAddMember)}
                                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600 rounded-lg text-blue-400 text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                                <Plus size={14} />
                                Add Member
                            </button>
                        </div>
                        {showAddMember && (
                            <div className="mb-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select a friend to add:</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {allFriends.filter(f => !group.members.includes(f.uid)).map(friend => (
                                        <div
                                            key={friend.uid}
                                            onClick={() => handleAddMember(friend.uid)}
                                            className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden">
                                                {friend.photoURL ? (
                                                    <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold text-xs">
                                                        {friend.displayName?.[0]?.toUpperCase() || 'U'}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-white text-sm">{friend.displayName || 'Unknown'}</span>
                                        </div>
                                    ))}
                                    {allFriends.filter(f => !group.members.includes(f.uid)).length === 0 && (
                                        <p className="text-xs text-gray-500 text-center py-2">All friends are already in this group</p>
                                    )}
                                </div>
                            </div>
                        )}
                        {loading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {members.map(member => (
                                    <div key={member.uid} className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl">
                                        <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                                            {member.photoURL ? (
                                                <img src={member.photoURL} alt={member.displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold">
                                                    {member.displayName?.[0]?.toUpperCase() || 'U'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{member.displayName || 'Unknown User'}</p>
                                            {member.uid === group.createdBy && (
                                                <p className="text-xs text-blue-400">Admin</p>
                                            )}
                                        </div>
                                        {group.createdBy === user.uid && member.uid !== user.uid && (
                                            <button
                                                onClick={() => handleRemoveMember(member.uid)}
                                                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600 rounded-lg text-red-400 text-xs font-medium transition-colors"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-800">
                    <button
                        onClick={handleLeaveGroup}
                        className="w-full px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600 rounded-xl text-red-400 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <UserMinus size={18} />
                        Leave Group
                    </button>
                </div>
            </div>
        </div>
    );
}

function SettingsModal({ onClose, onLogout, isDarkMode, toggleTheme }) {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <button
                        onClick={toggleTheme}
                        className="w-full p-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl flex items-center justify-between group transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'bg-purple-500/10 text-purple-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                            </div>
                            <span className="text-gray-900 dark:text-white font-medium">Dark Mode</span>
                        </div>
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors ${isDarkMode ? 'bg-blue-600' : 'bg-gray-600'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                    </button>

                    <button
                        onClick={onLogout}
                        className="w-full p-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl flex items-center justify-between group transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:bg-red-500/20 transition-colors">
                                <LogOut size={20} />
                            </div>
                            <span className="text-gray-900 dark:text-white font-medium">Log Out</span>
                        </div>
                        <ChevronLeft size={20} className="text-gray-500 rotate-180" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function ConversationsList({ friends, user, profile, chatsData, groupChatsData, friendProfiles, groups, onSelectFriend, onOpenProfile, onLogout, isDarkMode, toggleTheme }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState(profile?.displayName || '');


    const friendsWithUpdatedData = friends.map(friend => ({
        ...friend,
        ...friendProfiles[friend.uid],
        type: 'user'
    }));

    // Combine and sort all conversations by latest message - memoized to prevent re-sorting on every render
    const allConversations = useMemo(() => {
        return [
            ...friendsWithUpdatedData.map(f => ({
                ...f,
                lastMessageTime: chatsData[f.uid]?.lastMessage?.timestamp
            })),
            ...groups.map(g => ({
                ...g,
                lastMessageTime: groupChatsData[g.id]?.lastMessage?.timestamp
            }))
        ].sort((a, b) => {
            const timeA = a.lastMessageTime?.toMillis() || 0;
            const timeB = b.lastMessageTime?.toMillis() || 0;
            return timeB - timeA; // Most recent first
        });
    }, [friendsWithUpdatedData, groups, chatsData, groupChatsData]);

    const filteredConversations = useMemo(() => {
        if (!searchQuery) return allConversations;
        return allConversations.filter(conv =>
            (conv.name || conv.displayName)?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allConversations, searchQuery]);

    if (showCreateGroup) {
        return <CreateGroupModal user={user} friends={friendsWithUpdatedData} onClose={() => setShowCreateGroup(false)} />;
    }

    if (showSettings) {
        return <SettingsModal onClose={() => setShowSettings(false)} onLogout={onLogout} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />;
    }



    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800 transition-colors">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden cursor-pointer transition-colors" onClick={onOpenProfile}>
                            {profile?.photoURL ? (
                                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-semibold text-lg">
                                    {profile?.displayName?.[0]?.toUpperCase() || 'U'}
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            {editingName ? (
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newDisplayName}
                                        onChange={(e) => setNewDisplayName(e.target.value)}
                                        className="text-sm"
                                        placeholder="Enter name"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (newDisplayName.trim()) {
                                                try {
                                                    await updateDoc(doc(db, 'users', user.uid), {
                                                        displayName: newDisplayName.trim()
                                                    });
                                                    setEditingName(false);
                                                } catch (err) {
                                                    console.error("Error updating name:", err);
                                                }
                                            }
                                        }}
                                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingName(false);
                                            setNewDisplayName(profile?.displayName || '');
                                        }}
                                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Chats</h2>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCreateGroup(true)}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            title="New Group"
                        >
                            <Users size={20} />
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            title="Settings"
                        >
                            <Settings size={20} />
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-100 dark:bg-gray-900 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:bg-gray-200 dark:focus:bg-gray-800 transition-colors"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-gray-500 text-sm">No conversations found</p>
                    </div>
                ) : (
                    filteredConversations.map(conv => {
                        const isGroup = conv.type === 'group';
                        const id = isGroup ? conv.id : conv.uid;
                        const name = isGroup ? conv.name : conv.displayName;
                        const photo = conv.photoURL;
                        const chatData = isGroup ? (groupChatsData[id] || {}) : (chatsData[id] || {});

                        return (
                            <div
                                key={id}
                                onClick={() => onSelectFriend(conv)}
                                className="px-4 py-3 border-b border-gray-100 dark:border-gray-900 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors flex items-center gap-3"
                            >
                                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                                    {photo ? (
                                        <img src={photo} alt={name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-semibold text-lg">
                                            {isGroup ? <Users size={20} /> : (name?.[0]?.toUpperCase() || 'U')}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <h3 className={`font-semibold truncate ${chatData?.unreadCount > 0 ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-900 dark:text-white'}`}>{name || 'Unknown'}</h3>
                                        {chatData?.lastMessage?.timestamp && (
                                            <span className={`text-xs ${chatData?.unreadCount > 0 ? 'text-blue-500 font-bold' : 'text-gray-500'}`}>
                                                {new Date(chatData.lastMessage.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className={`text-sm truncate pr-2 ${chatData?.unreadCount > 0 ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500'}`}>
                                            {chatData?.lastMessage ? (
                                                chatData.lastMessage.type === 'image' ? (
                                                    <span className="flex items-center gap-1"><Camera size={14} /> Photo</span>
                                                ) : (
                                                    chatData.lastMessage.text
                                                )
                                            ) : (
                                                isGroup ? 'Group Chat' : 'Tap to chat'
                                            )}
                                        </p>
                                        {chatData?.unreadCount > 0 && (
                                            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                                <span className="text-xs font-bold text-white">{chatData.unreadCount}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div >
    );
}

function FriendSearchCard({ user }) {
    const [searchCode, setSearchCode] = useState('');
    const [result, setResult] = useState(null);
    const [status, setStatus] = useState(null);
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        if (!user?.uid) return;
        const q = query(collection(db, 'users', user.uid, 'friend_requests'), orderBy('timestamp', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, [user]);

    const handleSearch = async () => {
        if (!searchCode.trim()) return;
        setStatus('loading');
        setResult(null);

        try {
            const docRef = doc(db, 'users', searchCode.trim());
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setResult(docSnap.data());
                setStatus(null);
            } else {
                setStatus('not-found');
            }
        } catch (err) {
            setStatus('error');
        }
    };

    const sendRequest = async () => {
        if (!result || !user) return;
        setStatus('sending');
        try {
            const myProfile = await getDoc(doc(db, 'users', user.uid));
            await addDoc(collection(db, 'users', result.uid, 'friend_requests'), {
                fromUid: user.uid,
                fromName: myProfile.data()?.displayName || 'Unknown',
                fromPhoto: myProfile.data()?.photoURL || null,
                timestamp: serverTimestamp()
            });
            setStatus('sent');
        } catch (err) {
            setStatus('error');
        }
    };

    const handleRequest = async (req, accept) => {
        try {
            if (accept) {
                const myProfile = await getDoc(doc(db, 'users', user.uid));

                await setDoc(doc(db, 'users', user.uid, 'friends', req.fromUid), {
                    uid: req.fromUid,
                    displayName: req.fromName,
                    photoURL: req.fromPhoto || null,
                    addedAt: serverTimestamp()
                });

                await setDoc(doc(db, 'users', req.fromUid, 'friends', user.uid), {
                    uid: user.uid,
                    displayName: myProfile.data()?.displayName,
                    photoURL: myProfile.data()?.photoURL || null,
                    addedAt: serverTimestamp()
                });
            }
            await deleteDoc(doc(db, 'users', user.uid, 'friend_requests', req.id));
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
                <div>
                    <h3 className="font-semibold text-white mb-1">Add Friend</h3>
                    <p className="text-sm text-gray-400">Enter friend code to connect</p>
                </div>
                <div className="flex gap-2">
                    <Input
                        value={searchCode}
                        onChange={(e) => setSearchCode(e.target.value)}
                        placeholder="Paste friend code"
                        className="flex-1"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={status === 'loading'}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 text-white rounded-xl font-medium transition-colors"
                    >
                        {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                    </button>
                </div>

                {status === 'not-found' && (
                    <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm">
                        User not found
                    </div>
                )}

                {result && (
                    <div className="flex items-center justify-between p-3 bg-gray-800 rounded-xl border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden">
                                {result.photoURL ? (
                                    <img src={result.photoURL} alt={result.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold">
                                        {result.displayName?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                )}
                            </div>
                            <span className="font-medium text-white">{result.displayName || 'Unknown User'}</span>
                        </div>
                        {status === 'sent' ? (
                            <span className="text-green-400 text-sm flex items-center gap-1">
                                <Check size={16} /> Sent
                            </span>
                        ) : (
                            <button
                                onClick={sendRequest}
                                disabled={status === 'sending'}
                                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {status === 'sending' ? 'Sending...' : 'Add'}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {requests.length > 0 && (
                <div className="space-y-3">
                    <h3 className="font-semibold text-white px-1">Friend Requests</h3>
                    <div className="space-y-2">
                        {requests.map(req => (
                            <div key={req.id} className="flex items-center justify-between p-3 bg-gray-900 border border-gray-800 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden">
                                        {req.fromPhoto ? (
                                            <img src={req.fromPhoto} alt={req.fromName} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold">
                                                {req.fromName?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-medium text-white">{req.fromName || 'Unknown User'}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRequest(req, true)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm font-medium transition-colors"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleRequest(req, false)}
                                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 text-sm font-medium transition-colors"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-2">
                <h3 className="font-semibold text-white">Your Friend Code</h3>
                <div
                    onClick={() => navigator.clipboard.writeText(user.uid)}
                    className="bg-black p-4 rounded-xl border border-gray-800 cursor-pointer hover:border-gray-700 transition-colors group"
                >
                    <p className="text-gray-400 font-mono text-sm break-all group-hover:text-white transition-colors text-center">{user.uid}</p>
                </div>
                <p className="text-xs text-center text-gray-500">Tap code to copy</p>
            </div>
        </div>
    );
}

function ChatView({ user, profile, friend, onBack }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [showGroupInfo, setShowGroupInfo] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const [messageSenders, setMessageSenders] = useState({});
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const imageInputRef = useRef(null);
    const messageInputRef = useRef(null);

    const isGroup = friend.type === 'group';
    const isInitialLoad = useRef(true);
    const prevMessageCount = useRef(0);

    useEffect(() => {
        isInitialLoad.current = true;
        prevMessageCount.current = 0;
    }, [friend.uid, friend.id]);

    useEffect(() => {
        let q;
        if (isGroup) {
            q = query(
                collection(db, 'groups', friend.id, 'messages'),
                orderBy('timestamp', 'asc')
            );
        } else {
            const chatId = [user.uid, friend.uid].sort().join('_');
            q = query(
                collection(db, 'chats', chatId, 'messages'),
                orderBy('timestamp', 'asc')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(newMessages);

            // If chat is empty, we are ready immediately
            if (newMessages.length === 0) {
                isInitialLoad.current = false;
            }
        });

        return unsubscribe;
    }, [user, friend, isGroup]);

    // Separate effect for scrolling
    useLayoutEffect(() => {
        if (messages.length > 0 && chatContainerRef.current) {
            if (isInitialLoad.current) {
                // Instant scroll on first load - directly set scrollTop
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                isInitialLoad.current = false;
            } else if (messages.length > prevMessageCount.current) {
                // Smooth scroll for new messages
                chatContainerRef.current.scrollTo({
                    top: chatContainerRef.current.scrollHeight,
                    behavior: 'smooth'
                });
            }
            prevMessageCount.current = messages.length;
        }
    }, [messages]);

    // Fetch sender profiles for group messages - optimized to only fetch new senders
    useEffect(() => {
        if (!isGroup || !messages.length) return;

        const fetchSenders = async () => {
            const senderIds = [...new Set(messages.map(m => m.senderId).filter(Boolean))];
            const newSenderIds = senderIds.filter(uid => !messageSenders[uid]);

            if (newSenderIds.length === 0) return; // No new senders to fetch

            const senderData = {};
            for (const uid of newSenderIds) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        senderData[uid] = userDoc.data();
                    }
                } catch (err) {
                    console.error("Error fetching sender:", err);
                }
            }

            if (Object.keys(senderData).length > 0) {
                setMessageSenders(prev => ({ ...prev, ...senderData }));
            }
        };

        fetchSenders();
    }, [messages.length, isGroup]); // Only re-run when message count changes, not on every message update

    const sendMessage = async (text = '', imageUrl = null) => {
        if (!text.trim() && !imageUrl) return;

        const chatId = [user.uid, friend.uid].sort().join('_');
        const messageText = text.trim();
        setNewMessage('');

        try {
            const collectionPath = isGroup ? `groups/${friend.id}/messages` : `chats/${[user.uid, friend.uid].sort().join('_')}/messages`;
            await addDoc(collection(db, collectionPath), {
                text: messageText,
                imageUrl,
                type: imageUrl ? 'image' : 'text',
                senderId: user.uid,
                senderName: profile?.displayName || 'Unknown', // Add sender name for groups
                timestamp: serverTimestamp(),
                seen: false
            });
        } catch (err) {
            console.error("Failed to send", err);
        }
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const path = isGroup ? `groups/${friend.id}` : `chats/${[user.uid, friend.uid].sort().join('_')}`;
            const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            await sendMessage('', url);
        } catch (err) {
            console.error("Error uploading image:", err);
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        if (!messages.length) return;

        const unreadMessages = messages.filter(msg =>
            msg.senderId !== user.uid && !msg.seen
        );

        unreadMessages.forEach(async (msg) => {
            try {
                let msgRef;
                if (isGroup) {
                    msgRef = doc(db, 'groups', friend.id, 'messages', msg.id);
                } else {
                    const chatId = [user.uid, friend.uid].sort().join('_');
                    msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
                }
                await updateDoc(msgRef, { seen: true });
            } catch (err) {
                console.error("Failed to update message status", err);
            }
        });
    }, [messages, user, friend, isGroup]);

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-black h-full relative transition-colors">
            {fullScreenImage && (
                <div
                    className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
                    onClick={() => setFullScreenImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
                        onClick={() => setFullScreenImage(null)}
                    >
                        <X size={32} />
                    </button>
                    <img
                        src={fullScreenImage}
                        alt="Full screen"
                        className="max-w-full max-h-full object-contain rounded-lg"
                    />
                </div>
            )}

            {showGroupInfo && isGroup && (
                <GroupInfoModal
                    group={friend}
                    user={user}
                    profile={profile}
                    onClose={() => setShowGroupInfo(false)}
                    onLeave={() => {
                        setShowGroupInfo(false);
                        onBack();
                    }}
                />
            )}

            <div className="sticky top-0 z-10 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-black flex items-center justify-between shadow-lg transition-colors">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 -ml-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div
                        className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden cursor-pointer"
                        onClick={() => isGroup && setShowGroupInfo(true)}
                    >
                        {friend.photoURL ? (
                            <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-semibold">
                                {isGroup ? <Users size={20} /> : (friend.displayName?.[0]?.toUpperCase() || 'U')}
                            </div>
                        )}
                    </div>
                    <div
                        className="cursor-pointer"
                        onClick={() => isGroup && setShowGroupInfo(true)}
                    >
                        <h3 className="font-semibold text-gray-900 dark:text-white">{friend.displayName || friend.name || 'Unknown'}</h3>
                        <p className="text-xs text-gray-500">{isGroup ? `${friend.members?.length || 0} members` : 'Active now'}</p>
                    </div>
                </div>

                <div className="relative group">
                    <button className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                        <MoreVertical size={20} />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden hidden group-hover:block z-50 transition-colors">
                        <button
                            onClick={async () => {
                                if (window.confirm('Are you sure you want to remove this friend? Chat history will be kept.')) {
                                    try {
                                        await deleteDoc(doc(db, 'users', user.uid, 'friends', friend.uid));
                                        await deleteDoc(doc(db, 'users', friend.uid, 'friends', user.uid));
                                        onBack();
                                    } catch (err) {
                                        console.error("Error removing friend:", err);
                                    }
                                }
                            }}
                            className="w-full px-4 py-3 text-left text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-600 dark:hover:text-red-300 flex items-center gap-2 transition-colors"
                        >
                            <Trash2 size={16} />
                            Remove Friend
                        </button>
                    </div>
                </div>
            </div>

            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 bg-white dark:bg-black transition-colors"
            >
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No messages yet. Say hi! 👋</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {messages.map((msg, idx) => {
                            // Render system messages differently
                            if (msg.type === 'system') {
                                return (
                                    <div key={msg.id} className="flex justify-center my-2">
                                        <p className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800/50 px-3 py-1.5 rounded-full">
                                            {msg.text}
                                        </p>
                                    </div>
                                );
                            }

                            const isMe = msg.senderId === user.uid;
                            const prevMsg = messages[idx - 1];
                            const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;

                            return (
                                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    {!isMe && (
                                        <div className="w-7 h-7 mb-0.5 flex-shrink-0">
                                            {showAvatar ? (
                                                <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                                                    {friend.photoURL && !isGroup ? (
                                                        <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-semibold text-xs">
                                                            {isGroup ? <Users size={12} /> : (friend.displayName?.[0]?.toUpperCase() || 'U')}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7"></div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-col items-end max-w-[70%]">
                                        {isGroup && !isMe && showAvatar && (
                                            <span className="text-[10px] text-gray-500 mr-auto ml-1 mb-0.5">
                                                {messageSenders[msg.senderId]?.displayName || msg.senderName || 'Unknown'}
                                            </span>
                                        )}
                                        <div
                                            className={`${isMe
                                                ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                                                : 'bg-gray-100 dark:bg-[#3e4042] text-gray-900 dark:text-white rounded-2xl rounded-bl-md'
                                                } ${msg.type === 'image' ? 'p-1' : 'px-3 py-2'}`}
                                        >
                                            {msg.type === 'image' ? (
                                                <div
                                                    className="cursor-pointer"
                                                    onClick={() => setFullScreenImage(msg.imageUrl)}
                                                >
                                                    <img
                                                        src={msg.imageUrl}
                                                        alt="Sent image"
                                                        className="rounded-xl max-w-full max-h-64 object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <p className="text-[15px] leading-snug break-words whitespace-pre-wrap">
                                                    {msg.text}
                                                </p>
                                            )}
                                        </div>
                                        {isMe && (
                                            <div className="flex items-center gap-1 mt-0.5 mr-1">
                                                {msg.seen ? (
                                                    <CheckCheck size={14} className="text-blue-400" />
                                                ) : (
                                                    <CheckCheck size={14} className="text-gray-500" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="sticky bottom-0 p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-black shadow-lg transition-colors">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newMessage.trim()) {
                        sendMessage(newMessage);
                    }
                }} className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={imageInputRef}
                        onChange={handleImageSelect}
                        accept="image/*"
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={uploading}
                        className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                    >
                        {uploading ? <Loader2 size={24} className="animate-spin" /> : <ImageIcon size={24} />}
                    </button>
                    <div className="flex-1 bg-gray-100 dark:bg-[#3a3b3c] rounded-full px-4 py-2.5 flex items-center transition-colors">
                        <input
                            ref={messageInputRef}
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Message..."
                            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${newMessage.trim()
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 dark:bg-[#3a3b3c] text-gray-500 dark:text-gray-600'
                            }`}
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
}
