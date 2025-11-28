import React, { useState, useEffect, useRef } from 'react';
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
    Image as ImageIcon
} from 'lucide-react';

const Input = ({ value, onChange, placeholder, type = "text", className = "" }) => (
    <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors ${className}`}
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

export default function App() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('auth');
    const [activeChat, setActiveChat] = useState(null);
    const [friends, setFriends] = useState([]);

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
        return <Auth />;
    }

    if (view === 'profile') {
        return <ProfileSetup user={user} profile={profile} onSave={() => setView('conversations')} />;
    }

    return (
        <div className="h-screen bg-black flex flex-col md:flex-row max-w-7xl mx-auto overflow-hidden">
            {(view === 'conversations' || window.innerWidth >= 768) && (
                <div className={`${view === 'chat' && window.innerWidth < 768 ? 'hidden' : ''} md:w-96 w-full border-r border-gray-800 flex flex-col bg-black`}>
                    <ConversationsList
                        friends={friends}
                        user={user}
                        profile={profile}
                        onSelectFriend={(friend) => {
                            setActiveChat(friend);
                            setView('chat');
                        }}
                        onOpenProfile={() => setView('profile')}
                        onLogout={handleLogout}
                    />
                </div>
            )}

            {view === 'chat' && activeChat ? (
                <ChatView
                    user={user}
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

function ProfileSetup({ user, profile, onSave }) {
    const [name, setName] = useState(profile?.displayName || '');
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(profile?.photoURL || null);
    const [saving, setSaving] = useState(false);
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

            onSave();
        } catch (error) {
            console.error("Error saving profile:", error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Profile Setup</h1>
                    <p className="text-gray-400">Customize your profile</p>
                </div>

                <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 space-y-6">
                    <div className="flex flex-col items-center gap-4">
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="relative w-24 h-24 rounded-full bg-gray-800 cursor-pointer overflow-hidden group border-2 border-gray-700 hover:border-gray-500 transition-colors"
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
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                        />
                    </div>

                    <Button onClick={handleSave} disabled={saving || !name.trim()}>
                        {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Profile'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function ConversationsList({ friends, user, profile, onSelectFriend, onOpenProfile, onLogout }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [friendProfiles, setFriendProfiles] = useState({});
    const [showAddFriend, setShowAddFriend] = useState(false);

    const [chatsData, setChatsData] = useState({});

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

    const friendsWithUpdatedData = friends.map(friend => ({
        ...friend,
        ...friendProfiles[friend.uid]
    }));

    const filteredFriends = friendsWithUpdatedData.filter(friend =>
        friend.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (showAddFriend) {
        return (
            <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3">
                    <button onClick={() => setShowAddFriend(false)} className="text-gray-400 hover:text-white">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-xl font-bold text-white">Add Friend</h2>
                </div>
                <div className="p-4 overflow-y-auto">
                    <FriendSearchCard user={user} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div onClick={onOpenProfile} className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden cursor-pointer border border-gray-700">
                            {profile?.photoURL ? (
                                <img src={profile.photoURL} alt="Me" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <User size={20} />
                                </div>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-white">Chats</h1>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddFriend(true)}
                            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-white"
                            title="Add Friend"
                        >
                            <User size={20} />
                        </button>
                        <button
                            onClick={onLogout}
                            className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 hover:text-red-400"
                            title="Logout"
                        >
                            <LogOut size={20} />
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
                        className="w-full bg-gray-900 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-gray-800 transition-colors"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                {filteredFriends.length === 0 ? (
                    <div className="p-8 text-center">
                        <p className="text-gray-500 text-sm">No conversations found</p>
                    </div>
                ) : (
                    filteredFriends.map(friend => (
                        <div
                            key={friend.id}
                            onClick={() => onSelectFriend(friend)}
                            className="px-4 py-3 border-b border-gray-900 hover:bg-gray-900 cursor-pointer transition-colors flex items-center gap-3"
                        >
                            <div className="w-12 h-12 rounded-full bg-gray-800 overflow-hidden flex-shrink-0">
                                {friend.photoURL ? (
                                    <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold text-lg">
                                        {friend.displayName?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <h3 className="font-semibold text-white truncate">{friend.displayName || 'Unknown User'}</h3>
                                    {chatsData[friend.uid]?.lastMessage?.timestamp && (
                                        <span className={`text-xs ${chatsData[friend.uid]?.unreadCount > 0 ? 'text-blue-500 font-bold' : 'text-gray-500'}`}>
                                            {new Date(chatsData[friend.uid].lastMessage.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={`text-sm truncate pr-2 ${chatsData[friend.uid]?.unreadCount > 0 ? 'text-white font-bold' : 'text-gray-500'}`}>
                                        {chatsData[friend.uid]?.lastMessage ? (
                                            chatsData[friend.uid].lastMessage.type === 'image' ? (
                                                <span className="flex items-center gap-1"><Camera size={14} /> Photo</span>
                                            ) : (
                                                chatsData[friend.uid].lastMessage.text
                                            )
                                        ) : (
                                            'Tap to chat'
                                        )}
                                    </p>
                                    {chatsData[friend.uid]?.unreadCount > 0 && (
                                        <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-white">{chatsData[friend.uid].unreadCount}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
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
                                        className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors"
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleRequest(req, false)}
                                        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 transition-colors"
                                    >
                                        <X size={16} />
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

function ChatView({ user, friend, onBack }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [uploading, setUploading] = useState(false);
    const [fullScreenImage, setFullScreenImage] = useState(null);
    const messagesEndRef = useRef(null);
    const imageInputRef = useRef(null);

    useEffect(() => {
        const chatId = [user.uid, friend.uid].sort().join('_');
        const q = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });

        return unsubscribe;
    }, [user, friend]);

    const sendMessage = async (text = '', imageUrl = null) => {
        if (!text.trim() && !imageUrl) return;

        const chatId = [user.uid, friend.uid].sort().join('_');
        setNewMessage('');

        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: text.trim(),
                imageUrl,
                type: imageUrl ? 'image' : 'text',
                senderId: user.uid,
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
            const storageRef = ref(storage, `chats/${[user.uid, friend.uid].sort().join('_')}/${Date.now()}_${file.name}`);
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
        const chatId = [user.uid, friend.uid].sort().join('_');
        const unreadMessages = messages.filter(msg =>
            msg.senderId === friend.uid && !msg.seen
        );

        unreadMessages.forEach(async (msg) => {
            try {
                const msgRef = doc(db, 'chats', chatId, 'messages', msg.id);
                await updateDoc(msgRef, { seen: true });
            } catch (err) {
                console.error("Failed to update message status", err);
            }
        });
    }, [messages, user, friend]);

    return (
        <div className="flex-1 flex flex-col bg-[#1a1a1a] h-full relative">
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

            <div className="sticky top-0 z-10 px-4 py-3 border-b border-gray-800 bg-[#1a1a1a] flex items-center gap-3 shadow-lg">
                <button
                    onClick={onBack}
                    className="p-1.5 -ml-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-full transition-all"
                >
                    <ChevronLeft size={24} />
                </button>
                <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden">
                    {friend.photoURL ? (
                        <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold">
                            {friend.displayName?.[0]?.toUpperCase() || 'U'}
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="font-semibold text-white">{friend.displayName || 'Unknown User'}</h3>
                    <p className="text-xs text-gray-500">Active now</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#1a1a1a]" style={{ scrollBehavior: 'smooth' }}>
                {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-gray-600 text-sm">No messages yet. Say hi! 👋</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {messages.map((msg, idx) => {
                            const isMe = msg.senderId === user.uid;
                            const prevMsg = messages[idx - 1];
                            const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;

                            return (
                                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    {!isMe && (
                                        <div className="w-7 h-7 mb-0.5 flex-shrink-0">
                                            {showAvatar ? (
                                                <div className="w-7 h-7 rounded-full bg-gray-800 overflow-hidden">
                                                    {friend.photoURL ? (
                                                        <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-semibold text-xs">
                                                            {friend.displayName?.[0]?.toUpperCase() || 'U'}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-7 h-7"></div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-col items-end max-w-[70%]">
                                        <div
                                            className={`${isMe
                                                ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                                                : 'bg-[#3e4042] text-white rounded-2xl rounded-bl-md'
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

            <div className="sticky bottom-0 p-3 border-t border-gray-800 bg-[#1a1a1a] shadow-lg">
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(newMessage); }} className="flex items-center gap-2">
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
                        className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        {uploading ? <Loader2 size={24} className="animate-spin" /> : <ImageIcon size={24} />}
                    </button>
                    <div className="flex-1 bg-[#3a3b3c] rounded-full px-4 py-2.5 flex items-center">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Message..."
                            className="flex-1 bg-transparent outline-none text-white placeholder-gray-500"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${newMessage.trim()
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-[#3a3b3c] text-gray-600'
                            }`}
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
}
