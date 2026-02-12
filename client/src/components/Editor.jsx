import React, { useEffect, useRef } from 'react';
import { Editor as MonacoEditor } from '@monaco-editor/react'; // Alias to avoid conflict if any, though not needed here
import ACTIONS from '../Actions';

const Editor = ({ socketRef, roomId, onCodeChange, language }) => {
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const cursorsRef = useRef({}); // Stores decoration IDs per socketId
    const lastCursorPositionRef = useRef({}); // Store cursor position data
    const styleElementRef = useRef(null);

    function handleEditorDidMount(editor, monaco) {
        editorRef.current = editor;
        monacoRef.current = monaco;

        // Create style element for dynamic cursor colors
        if (!styleElementRef.current) {
            const style = document.createElement('style');
            style.id = 'cursor-styles';
            document.head.appendChild(style);
            styleElementRef.current = style;
        }
        
        editor.onDidChangeModelContent((event) => {
             const code = editor.getValue();
             const cursor = editor.getPosition();
             onCodeChange(code, cursor);
        });

        editor.onDidChangeCursorPosition((e) => {
            const position = e.position; // { lineNumber: 1, column: 1 }
            if (socketRef.current) {
                socketRef.current.emit(ACTIONS.CURSOR_CHANGE, {
                    roomId,
                    cursor: position
                });
            }
        });
    }

    // Helper to generate dynamic CSS for user cursor
    const getCursorStyle = (socketId, color, username) => {
        return `
            .cursor-${socketId} {
                border-left: 2px solid ${color};
                border-right: 4px solid transparent; 
                margin-left: -1px;
            }
            .cursor-${socketId}::after {
                content: "${username || 'Guest'}";
                position: absolute;
                left: 0;
                background: ${color};
                color: #fff;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 10px;
                opacity: 0.8; 
                transition: opacity 0.2s;
                pointer-events: none;
                white-space: nowrap;
                z-index: 10;
            }
            .cursor-${socketId}.cursor-label-up::after {
                top: -18px;
            }
            .cursor-${socketId}.cursor-label-down::after {
                top: 20px;
            }
            .cursor-${socketId}:hover::after {
                opacity: 1;
            }
        `;
    };

    // Helper to generate random color
    const getRandomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    };

    const userColors = useRef({});

    useEffect(() => {
        const socket = socketRef.current;
        if (socket) {
            socket.on(ACTIONS.CODE_CHANGE, ({ code, cursor: senderCursor, socketId: senderSocketId, username: senderUsername }) => {
                const currentCode = editorRef.current.getValue();
                if (code !== currentCode) {
                    editorRef.current.setValue(code);
                    
                    // If we have the sender's new cursor, update it immediately to prevent jumping
                    if (senderSocketId && senderCursor) {
                        lastCursorPositionRef.current[senderSocketId] = { 
                            cursor: senderCursor, 
                            username: senderUsername 
                        };
                    }

                    // Re-apply cursors
                    Object.entries(lastCursorPositionRef.current).forEach(([socketId, { cursor, username }]) => {
                         if (!userColors.current[socketId]) return;
                         
                         const model = editorRef.current.getModel();
                         if (!model) return;
                         
                         const maxLine = model.getLineCount();
                         // Validate and Clamp
                         let safeLine = Math.min(Math.max(1, cursor.lineNumber), maxLine);
                         let safeCol = Math.min(Math.max(1, cursor.column), model.getLineMaxColumn(safeLine));
                        
                         // Decide label position
                         const labelClass = safeLine === 1 ? 'cursor-label-down' : 'cursor-label-up';

                         const newDecorations = [{
                             range: new monacoRef.current.Range(safeLine, safeCol, safeLine, safeCol),
                             options: { className: `cursor-${socketId} ${labelClass}` }
                         }];
                         
                         try {
                             cursorsRef.current[socketId] = editorRef.current.deltaDecorations(
                                 cursorsRef.current[socketId] || [],
                                 newDecorations
                             );
                         } catch (e) {
                             console.error("Re-apply cursor failed", e);
                         }
                    });
                }
            });

            socket.on(ACTIONS.CURSOR_CHANGE, ({ socketId, cursor, username }) => {
                if (!editorRef.current || !monacoRef.current || !cursor || !cursor.lineNumber || !cursor.column) return;
                
                // Validate cursor bounds
                const model = editorRef.current.getModel();
                if (!model) return;
                
                const maxLine = model.getLineCount();
                const maxCol = model.getLineMaxColumn(Math.min(maxLine, Math.max(1, cursor.lineNumber)));

                // Clamp cursor to valid range to prevent "Illegal argument"
                const safeLine = Math.min(Math.max(1, cursor.lineNumber), maxLine);
                const safeCol = Math.min(Math.max(1, cursor.column), maxCol);

                // Update last known position
                lastCursorPositionRef.current[socketId] = { cursor: { lineNumber: safeLine, column: safeCol }, username };

                // Assign color if not exists
                if (!userColors.current[socketId]) {
                    userColors.current[socketId] = getRandomColor();
                    // Append style
                    if (styleElementRef.current) {
                        styleElementRef.current.innerHTML += getCursorStyle(
                            socketId, 
                            userColors.current[socketId],
                            username
                        );
                    }
                }

                // Decide label position
                const labelClass = safeLine === 1 ? 'cursor-label-down' : 'cursor-label-up';

                // Render cursor decoration
                let oldDecorations = [];
                if (cursorsRef.current[socketId]) {
                    oldDecorations = cursorsRef.current[socketId];
                }

                const newDecorations = [
                    {
                        range: new monacoRef.current.Range(
                            safeLine, 
                            safeCol, 
                            safeLine, 
                            safeCol
                        ),
                        options: {
                            className: `cursor-${socketId} ${labelClass}`,
                        }
                    }
                ];

                try {
                   cursorsRef.current[socketId] = editorRef.current.deltaDecorations(
                       oldDecorations,
                       newDecorations
                   );
                } catch(e) {
                   console.error("Failed to render cursor:", e);
                }
            });

            // Handle user leaving to clean up cursors
            socket.on(ACTIONS.DISCONNECTED, ({ socketId }) => {
                if (cursorsRef.current[socketId] && editorRef.current) {
                    editorRef.current.deltaDecorations(cursorsRef.current[socketId], []);
                    delete cursorsRef.current[socketId];
                }
            });
        }

        return () => {
            if (socket) {
                socket.off(ACTIONS.CODE_CHANGE);
                socket.off(ACTIONS.CURSOR_CHANGE);
                socket.off(ACTIONS.DISCONNECTED);
            }
        };
    }, [socketRef.current]);

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <MonacoEditor
                height="100%"
                width="100%"
                language={language || 'javascript'}
                defaultValue="// Write your code here"
                theme="vs-dark"
                onMount={handleEditorDidMount}
                options={{
                    minimap: { enabled: false },
                    fontSize: 20,
                    wordWrap: 'on',
                    automaticLayout: true,
                }}
            />
        </div>
    );
};

export default Editor;
