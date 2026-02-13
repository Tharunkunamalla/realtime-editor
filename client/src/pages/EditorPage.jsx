import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Client from '../components/Client';
import Editor from '../components/Editor';
import Output from '../components/Output';
import { initSocket } from '../socket';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    const socketRef = useRef(null);
    const codeRef = useRef(null);
    const editorRef = useRef(null); // Reference to the actual Monaco editor instance? No, passed down to Editor component which passes it back?
    // Actually, Editor component has the ref internally. We need access to it in Output or lift the state up.
    // Better: Pass a ref from here to Editor, and also pass that ref to Output? 
    // Or just state. Let's use a ref passed to Editor.

    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);

    // We need the editor instance to get value in Output component, 
    // OR we just rely on codeRef.current which is updated on change.
    // But Output needs to send code. codeRef.current is the latest code.
    // However, Output might want to run code. valid point.
    // Let's pass a function to getCode or just use codeRef.
    
    // We need to pass the code to Output to run.
    // Since codeRef.current is updated on change, we can use that.
    
    // But we need the language too. For now hardcode or add selector.
    const [language, setLanguage] = useState('javascript');
    const [socketInitialized, setSocketInitialized] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langMenuRef = useRef(null);

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const LANGUAGES = [
        "javascript",
        "typescript",
        "python",
        "java",
        "csharp",
        "php",
    ];

    const handleLangChange = (lang) => {
        setLanguage(lang);
        setIsLangOpen(false);
        socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
            roomId,
            language: lang,
        });
    };

    useEffect(() => {
        const init = () => {
            socketRef.current = initSocket();
            socketRef.current.on('connect_error', (err) => handleErrors(err));
            socketRef.current.on('connect_failed', (err) => handleErrors(err));

            function handleErrors(e) {
                console.log('socket error', e);
                toast.error('Socket connection failed, try again later.');
                reactNavigator('/');
            }

            socketRef.current.emit(ACTIONS.JOIN, {
                roomId,
                username: location.state?.username,
            });

            // Listening for joined event
            socketRef.current.on(
                ACTIONS.JOINED,
                ({ clients, username, socketId }) => {
                    if (username !== location.state?.username) {
                        toast.success(`${username} joined the room.`);
                    }
                    setClients(clients);
                    socketRef.current.emit(ACTIONS.SYNC_CODE, {
                        code: codeRef.current,
                        socketId,
                        language, 
                    });
                }
            );

            // Listening for language change
            socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({ language }) => {
                setLanguage(language);
            });

            // Listening for disconnected
            socketRef.current.on(
                ACTIONS.DISCONNECTED,
                ({ socketId, username }) => {
                    toast.success(`${username} left the room.`);
                    setClients((prev) => {
                        return prev.filter(
                            (client) => client.socketId !== socketId
                        );
                    });
                }
            );

            setSocketInitialized(true);
        };
        init();
        return () => {
            if(socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
                socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
            }
        };
    }, []);

    async function copyRoomId() {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID has been copied to your clipboard');
        } catch (err) {
            toast.error('Could not copy the Room ID');
            console.error(err);
        }
    }

    function leaveRoom() {
        reactNavigator('/');
    }

    if (!location.state) {
        return <Navigate to="/" state={{ roomId }} />;
    }

    // Filter for unique usernames to display
    const uniqueClients = Array.from(new Set(clients.map(c => c.username)))
    .map(username => clients.find(c => c.username === username));

    return (
        <div className="mainWrap">
            <div className="aside">
                <button className="mobileMenuBtn" onClick={toggleMobileMenu}>
                    &#9776;
                </button>
                <div className={`asideInner ${isMobileMenuOpen ? 'show' : ''}`}>
                    <button className="closeMenuBtn" onClick={closeMobileMenu}>
                        &times;
                    </button>
                    <div className="logo">
                        <img
                            className="logoImage"
                            src="/code-sync.png"
                            alt="logo"
                        />
                    </div>
                    {/* Show connected status only when others are present */}
                    {uniqueClients.length > 1 && (
                        <>
                            <h3>Connected</h3>
                            <div className="clientsList">
                                {uniqueClients.map((client) => (
                                    <Client
                                        key={client.socketId}
                                        username={client.username}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                    {uniqueClients.length <= 1 && (
                         <div className="waitingForInfo">
                            <p>Waiting for others to join...</p>
                         </div>
                    )}
                    <button className="btn copyBtn" onClick={copyRoomId}>
                        Copy ROOM ID
                    </button>
                </div>
                {isMobileMenuOpen && <div className="mobileMenuOverlay" onClick={() => setIsMobileMenuOpen(false)}></div>}
                
                <div className="asideControls">
                    <div className="languageSelector" ref={langMenuRef}>
                        <div className="languageDropdown">
                            <div 
                                className="dropdownBtn" 
                                onClick={() => setIsLangOpen(!isLangOpen)}
                            >
                                {language.toUpperCase()}
                                <span className={`arrow ${isLangOpen ? 'open' : ''}`}>▼</span>
                            </div>
                            {isLangOpen && (
                                <div className="dropdownMenu">
                                    {LANGUAGES.map((lang) => (
                                        <div 
                                            key={lang} 
                                            className={`dropdownItem ${lang === language ? 'active' : ''}`}
                                            onClick={() => handleLangChange(lang)}
                                        >
                                            {lang.toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button className="btn leaveBtn" onClick={leaveRoom}>
                        Leave
                    </button>
                </div>
            </div>
            <div className="editorWrap">
                <Editor
                    socketRef={socketRef}
                    roomId={roomId}
                    onCodeChange={(code, cursor) => {
                        codeRef.current = code;
                        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                            roomId,
                            code,
                            cursor,
                        });
                    }}
                    language={language}
                />
                <Output 
                    editorRef={{ current: { getValue: () => codeRef.current } }} // Mocking editor ref for Output
                    language={language}
                />
            </div>
        </div>
    );
};

export default EditorPage;
