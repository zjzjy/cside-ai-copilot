"""Re-run only GLM-5.1, GLM-5.2, Hunyuan"""
import subprocess, os
os.environ["RERUN_ONLY"] = "GLM-5.1,GLM-5.2,Hunyuan-TurboS"
subprocess.run(["python", "test_prompt.py"])
