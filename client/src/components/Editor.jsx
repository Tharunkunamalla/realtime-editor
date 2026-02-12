import React, { useEffect, useRef } from 'react';
import { Editor as MonacoEditor } from '@monaco-editor/react'; // Alias to avoid conflict if any, though not needed here
import ACTIONS from '../Actions';

const Editor = ({ socketRef, roomId, onCodeChange, language }) => {
    const editorRef = useRef(null);
    const monacoRef = useRef(null);
    const cursorsRef = useRef({}); // Stores decoration IDs per socketId
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
             onCodeChange(code);
        });

        editor.onDidChangeCursorPosition((e) => {
            const position = e.position; // { lineNumber: 1, column: 1 }
            socketRef.current.emit(ACTIONS.CURSOR_CHANGE, {
                roomId,
                cursor: position
            });
        });
    }

    // Helper to generate dynamic CSS for user cursor
    const getCursorStyle = (socketId, color) => {
        return `
            .cursor-${socketId} {
                border-left: 2px solid ${color};
                margin-left: -1px; 
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
            socket.on(ACTIONS.CODE_CHANGE, ({ code }) => {
                const currentCode = editorRef.current.getValue();
                if (code !== currentCode) {
                    editorRef.current.setValue(code);
                }
            });

            socket.on(ACTIONS.CURSOR_CHANGE, ({ socketId, cursor, username }) => {
                if (!editorRef.current || !monacoRef.current) return;
                
                // Assign color if not exists
                if (!userColors.current[socketId]) {
                    userColors.current[socketId] = getRandomColor();
                    // Append style
                    if (styleElementRef.current) {
                        styleElementRef.current.innerHTML += getCursorStyle(
                            socketId, 
                            userColors.current[socketId]
                        );
                    }
                }

                // Render cursor decoration
                let oldDecorations = [];
                if (cursorsRef.current[socketId]) {
                    oldDecorations = cursorsRef.current[socketId];
                }

                const newDecorations = [
                    {
                        range: new monacoRef.current.Range(
                            cursor.lineNumber, 
                            cursor.column, 
                            cursor.lineNumber, 
                            cursor.column
                        ),
                        options: {
                            className: `cursor-${socketId}`,
                            hoverMessage: { value: username } 
                        }
                    }
                ];

                cursorsRef.current[socketId] = editorRef.current.deltaDecorations(
                    oldDecorations,
                    newDecorations
                );
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
