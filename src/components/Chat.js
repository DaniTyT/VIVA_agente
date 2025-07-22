import React, { useLayoutEffect, useRef, useEffect } from "react";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import InputBase from "@mui/material/InputBase";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Grow from "@mui/material/Grow";
import Fade from "@mui/material/Fade";
import { v4 as uuidv4 } from "uuid";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import TableRowsRoundedIcon from "@mui/icons-material/TableRowsRounded";
import AnswerDetailsDialog from "./AnswerDetailsDialog.js";
import { WELCOME_MESSAGE, MAX_LENGTH_INPUT_SEARCH } from "../env";
import MyChart from "./MyChart.js";
import Answering from "./Answering.js";
import QueryResultsDisplay from "./QueryResultsDisplay";
import {
  invokeBedrockAgent,
  getQueryResults,
  generateChart,
} from "../utils/AwsCalls";
import MarkdownRenderer from "./MarkdownRenderer.js";

const Chat = ({ userName = "Guest User" }) => {
  const [totalAnswers, setTotalAnswers] = React.useState(0);
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [controlAnswers, setControlAnswers] = React.useState([]);
  const [answers, setAnswers] = React.useState([]);
  const [query, setQuery] = React.useState("");
  const [sessionId, setSessionId] = React.useState(uuidv4());
  const [errorMessage, setErrorMessage] = React.useState("");
  const [height, setHeight] = React.useState(480);
  const [openAnswerDetails, setOpenAnswerDetails] = React.useState(false);
  const [size, setSize] = React.useState([0, 0]);
  const [selectedAB, setSelectedAB] = React.useState(0);

  const borderRadius = 8;

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [answers]);

  useLayoutEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
      const myh = window.innerHeight - 220;
      if (myh < 346) {
        setHeight(346);
      } else {
        setHeight(myh);
      }
    }
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const effectRan = React.useRef(false);
  useEffect(() => {
    if (!effectRan.current) {
      console.log("effect applied - only on the FIRST mount");
      const fetchData = async () => {
        console.log("Chat");
      };
      fetchData()
        // catch any error
        .catch(console.error);
    }
    return () => (effectRan.current = true);
  }, []);

  const handleQuery = (event) => {
    if (event.target.value.length > 0 && loading === false && query !== "")
      setEnabled(true);
    else setEnabled(false);
    setQuery(event.target.value.replace("\n", ""));
  };

  const handleKeyPress = (event) => {
    if (event.code === "Enter" && loading === false && query !== "") {
      getAnswer(query);
    }
  };

  const handleClick = async (e) => {
    e.preventDefault();
    if (query !== "") {
      getAnswer(query);
    }
  };

  const getAnswer = async (my_query) => {
    if (!loading && my_query !== "") {
      setControlAnswers((prevState) => [...prevState, {}]);
      setAnswers((prevState) => [...prevState, { query: my_query }]);
      setEnabled(false);
      setLoading(true);
      setErrorMessage("");
      setQuery("");

      try {
        const queryUuid = uuidv4();
        const {
          completion,
          usage,
          totalInputTokens,
          totalOutputTokens,
          runningTraces,
          countRationals,
        } = await invokeBedrockAgent(
          sessionId,
          my_query,
          setAnswers,
          setControlAnswers,
          userName,
          queryUuid
        );

        let json = {
          text: completion,
          usage,
          totalInputTokens,
          totalOutputTokens,
          runningTraces,
          queryUuid,
          countRationals
        };

        // Intentar generar la gráfica siempre, usando la respuesta del agente
        json.chart = "loading";
        setAnswers((prevState) => {
          const newState = [...prevState];
          for (let i = newState.length - 1; i >= 0; i--) {
            if (newState[i].isStreaming) {
              newState[i] = json;
              break;
            }
          }
          return newState;
        });

        // Generar la gráfica usando generateChart y actualizar la respuesta
        try {
          console.log("Llamando generateChart"); // <-- LOG ANTES DE LLAMAR
          const chartResult = await generateChart(json);
          console.log("Resultado de generateChart:", chartResult); // <-- LOG PARA DIAGNÓSTICO
          json.chart = chartResult;
          setAnswers((prevState) => {
            const newState = [...prevState];
            for (let i = newState.length - 1; i >= 0; i--) {
              if (newState[i].queryUuid === queryUuid) {
                newState[i] = json;
                break;
              }
            }
            return newState;
          });
        } catch (e) {
          console.error("Error en generateChart", e); // <-- LOG DE ERROR
          // Si no se puede generar la gráfica, dejar solo la respuesta textual
          json.chart = { rationale: "No chart generated" };
          setAnswers((prevState) => {
            const newState = [...prevState];
            for (let i = newState.length - 1; i >= 0; i--) {
              if (newState[i].queryUuid === queryUuid) {
                newState[i] = json;
                break;
              }
            }
            return newState;
          });
        }

        setLoading(false);
        setEnabled(false);
        setTotalAnswers((prevState) => prevState + 1);
      } catch (error) {
        console.log("Call failed: ", error);
        setErrorMessage(error.toString());
        setLoading(false);
        setEnabled(false);

        // Update the streaming answer with error state
        setAnswers((prevState) => {
          const newState = [...prevState];
          for (let i = newState.length - 1; i >= 0; i--) {
            if (newState[i].isStreaming) {
              newState[i] = {
                ...newState[i],
                text: "Error occurred while getting response",
                isStreaming: false,
                error: true,
              };
              break;
            }
          }
          return newState;
        });
      }
    }
  };

  const handleCloseAnswerDetails = () => {
    setOpenAnswerDetails(false);
  };

  const handleClickOpenAnswerDetails = (value) => () => {
    setSelectedAB(value);
    setOpenAnswerDetails(true);
  };

  const handleShowTab = (index, type) => () => {
    const updatedItems = [...controlAnswers];
    updatedItems[index] = { ...updatedItems[index], current_tab_view: type };
    setControlAnswers(updatedItems);
  };

  return (
    <Box sx={{ pl: 2, pr: 2, pt: 0, pb: 0 }}>
      {errorMessage !== "" && (
        <Alert
          severity="error"
          sx={{
            position: "fixed",
            width: "80%",
            top: "65px",
            left: "20%",
            marginLeft: "-10%",
          }}
          onClose={() => {
            setErrorMessage("");
          }}
        >
          {errorMessage}
        </Alert>
      )}

      <Box
        id="chatHelper"
        sx={{
          display: "flex",
          flexDirection: "column",
          height: height,
          overflow: "hidden",
          overflowY: "scroll",
        }}
      >
        {answers.length > 0 ? (
          <ul style={{ paddingBottom: 14, margin: 0, listStyleType: "none" }}>
            {answers.map((answer, index) => (
              <li key={"meg" + index} style={{ marginBottom: 0 }}>
                {answer.hasOwnProperty("text") ? (
                  <Box
                    sx={{
                      borderRadius: borderRadius,
                      pl: 1,
                      pr: 1,
                      display: "flex",
                      alignItems: "flex-start",
                      marginBottom: 1,
                    }}
                  >
                    <Box sx={{ pr: 1, pt: 1.5, pl: 0.5 }}>
                      <img
                        src="/images/Logo Corazon Viva.png"
                        alt="Amazon Bedrock"
                        height={20}
                      />
                    </Box>
                    <Box sx={{ p: 0, flex: 1 }}>
                      <Box>
                        <Grow
                          in={
                            controlAnswers[index].current_tab_view === "answer"
                          }
                          timeout={{ enter: 600, exit: 0 }}
                          style={{ transformOrigin: "50% 0 0" }}
                          mountOnEnter
                          unmountOnExit
                        >
                          <Box
                            id={"answer" + index}
                            sx={{
                              opacity: 0.8,
                              "&.MuiBox-root": {
                                animation: "fadeIn 0.8s ease-in-out forwards",
                              },
                              mt: 1,
                            }}
                          >
                            <Typography component="div" variant="body1">
                              <MarkdownRenderer content={answer.text} />
                            </Typography>
                          </Box>
                        </Grow>

                        {answer.hasOwnProperty("queryResults") && (
                          <Grow
                            in={
                              controlAnswers[index].current_tab_view ===
                              "records"
                            }
                            timeout={{ enter: 600, exit: 0 }}
                            style={{ transformOrigin: "50% 0 0" }}
                            mountOnEnter
                            unmountOnExit
                          >
                            <Box
                              sx={{
                                opacity: 0.8,
                                "&.MuiBox-root": {
                                  animation: "fadeIn 0.8s ease-in-out forwards",
                                },
                                transform: "translateY(10px)",
                                "&.MuiBox-root-appear": {
                                  transform: "translateY(0)",
                                },
                                mt: 1,
                              }}
                            >
                              <QueryResultsDisplay
                                index={index}
                                answer={answer}
                              />
                            </Box>
                          </Grow>
                        )}

                        {answer.hasOwnProperty("chart") &&
                          answer.chart.hasOwnProperty("chart_type") && (
                            <Grow
                              in={
                                controlAnswers[index].current_tab_view ===
                                "chart"
                              }
                              timeout={{ enter: 600, exit: 0 }}
                              style={{ transformOrigin: "50% 0 0" }}
                              mountOnEnter
                              unmountOnExit
                            >
                              <Box
                                sx={{
                                  opacity: 0.8,
                                  "&.MuiBox-root": {
                                    animation:
                                      "fadeIn 0.9s ease-in-out forwards",
                                  },
                                  transform: "translateY(10px)",
                                  "&.MuiBox-root-appear": {
                                    transform: "translateY(0)",
                                  },
                                  mt: 1,
                                }}
                              >
                                <MyChart
                                  caption={answer.chart.caption}
                                  options={
                                    answer.chart.chart_configuration.options
                                  }
                                  series={
                                    answer.chart.chart_configuration.series
                                  }
                                  type={answer.chart.chart_type}
                                />
                              </Box>
                            </Grow>
                          )}
                      </Box>

                      {/* Mostrar los botones de pestaña si hay gráfica o datos tabulares */}
                      {(answer.hasOwnProperty("chart") && answer.chart.hasOwnProperty("chart_type")) || answer.hasOwnProperty("queryResults") ? (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            gap: 1,
                            py: 1,
                            mt: 1,
                          }}
                        >
                          {/* Botón Answer */}
                          <Button
                            sx={(theme) => ({
                              pr: 1,
                              pl: 1,
                              "&.Mui-disabled": {
                                borderBottom: 0.5,
                                color: theme.palette.primary.main,
                                borderRadius: 0,
                              },
                            })}
                            size="small"
                            color="secondaryText"
                            disabled={controlAnswers[index].current_tab_view === "answer"}
                            onClick={handleShowTab(index, "answer")}
                            startIcon={<QuestionAnswerOutlinedIcon />}
                          >
                            Answer
                          </Button>

                          {/* Botón Records solo si hay datos tabulares */}
                          {answer.hasOwnProperty("queryResults") && (
                            <Button
                              sx={(theme) => ({
                                pr: 1,
                                pl: 1,
                                "&.Mui-disabled": {
                                  borderBottom: 0.5,
                                  color: theme.palette.primary.main,
                                  borderRadius: 0,
                                },
                              })}
                              size="small"
                              color="secondaryText"
                              disabled={controlAnswers[index].current_tab_view === "records"}
                              onClick={handleShowTab(index, "records")}
                              startIcon={<TableRowsRoundedIcon />}
                            >
                              Records
                            </Button>
                          )}

                          {/* Botón Chart si hay gráfica */}
                          {answer.hasOwnProperty("chart") && answer.chart.hasOwnProperty("chart_type") && (
                            <Button
                              sx={(theme) => ({
                                pr: 1,
                                pl: 1,
                                "&.Mui-disabled": {
                                  borderBottom: 0.5,
                                  color: theme.palette.primary.main,
                                  borderRadius: 0,
                                },
                              })}
                              size="small"
                              color="secondaryText"
                              disabled={controlAnswers[index].current_tab_view === "chart"}
                              onClick={handleShowTab(index, "chart")}
                              startIcon={<InsightsOutlinedIcon />}
                            >
                              Chart
                            </Button>
                          )}
                        </Box>
                      ) : null}

                      {answer.chart === "loading" && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            ml: 1,
                          }}
                        >
                          <CircularProgress size={16} color="primary" />
                          <Typography
                            variant="caption"
                            color="secondaryText"
                            sx={{ ml: 1 }}
                          >
                            Generando gráfica...
                          </Typography>
                        </Box>
                      )}

                      {answer.chart && answer.chart.hasOwnProperty("rationale") && (
                        <Typography variant="caption" color="secondaryText">
                          {answer.chart.rationale}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ) : answer.hasOwnProperty("query") ? (
                  <Grid container justifyContent="flex-end">
                    <Box
                      sx={(theme) => ({
                        textAlign: "right",
                        borderRadius: borderRadius,
                        fontWeight: 500,
                        pt: 1,
                        pb: 1,
                        pl: 2,
                        pr: 2,
                        mt: 2,
                        mb: 1.5,
                        mr: 1,
                        boxShadow: "rgba(0, 0, 0, 0.05) 0px 4px 12px",
                        background: "#2e9338",
                        color: "#fff",
                      })}
                    >
                      <Typography variant="body1" sx={{ color: '#fff' }}>{answer.query}</Typography>
                    </Box>
                  </Grid>
                ) : null}
              </li>
            ))}

            {loading && (
              <Box sx={{ p: 0, pl: 1, mb: 2, mt: 1 }}>
                <Answering loading={loading} />
              </Box>
            )}

            {/* this is the last item that scrolls into
                    view when the effect is run */}
            <li ref={scrollRef} />
          </ul>
        ) : (
          <Box
            textAlign={"center"}
            sx={{
              pl: 1,
              pt: 1,
              pr: 1,
              pb: 6,
              height: height,
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            <div style={{ width: "100%", height: "100%" }}>
              <img
                src="https://seatmaps.com/assets/logo/logo-VB.png"
                alt="Agents for Amazon Bedrock"
              />
              <Typography variant="h5" sx={{ pb: 1, fontWeight: 500 }}>
                VIVA - Agente Analista
              </Typography>
              <Typography sx={{ pb: 4, fontWeight: 400 }}>
                Soy un asistente especializado en análisis de datos y optimización de operaciones para VIVA. Mi objetivo principal es analizar el rendimiento de los agentes utilizando datos históricos y en tiempo real, identificando tendencias, oportunidades de mejora y generando insights accionables
              </Typography>
              <Typography
                color="primary"
                sx={{ fontSize: "1.1rem", pb: 1, fontWeight: 500 }}
              >
              </Typography>
            </div>
          </Box>
        )}
      </Box>

      <Paper
        component="form"
        sx={(theme) => ({
          zIndex: 0,
          p: 1,
          mb: 2,
          display: "flex",
          alignItems: "center",
          boxShadow:
            "rgba(17, 17, 26, 0.05) 0px 4px 16px, rgba(17, 17, 26, 0.05) 0px 8px 24px, rgba(17, 17, 26, 0.05) 0px 16px 56px",
          border: 1,
          borderColor: "divider",
          borderRadius: 6,
        })}
      >
        <Box sx={{ pt: 1.5, pl: 0.5 }}>
          <img
            src="/images/Logo Corazon Viva.png"
            alt="Amazon Web Services"
            height={20}
          />
        </Box>
        <InputBase
          required
          id="query"
          name="query"
          placeholder="Escribe tu pregunta aquí"
          fullWidth
          multiline
          onChange={handleQuery}
          onKeyDown={handleKeyPress}
          value={query}
          variant="outlined"
          inputProps={{ maxLength: MAX_LENGTH_INPUT_SEARCH }}
          sx={{ pl: 1, pr: 2 }}
        />
        <Divider sx={{ height: 32 }} orientation="vertical" />
        <IconButton
          sx={{ p: 1 }}
          aria-label="directions"
          disabled={!enabled}
          onClick={handleClick}
        >
          <SendIcon sx={{ color: '#2e9338' }} />
        </IconButton>
      </Paper>

      {selectedAB > 0 && (
        <AnswerDetailsDialog
          open={openAnswerDetails}
          handleClose={handleCloseAnswerDetails}
          answer={answers[selectedAB]}
          question={
            answers[selectedAB - (answers[selectedAB].countRationals + 1)].query
          }
        />
      )}
    </Box>
  );
};

export default Chat;
