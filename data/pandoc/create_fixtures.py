import os
import subprocess

for root_dir, _, filenames in os.walk('markdown'):

  for md in filenames:
    if not md.endswith(".md"):
      continue

    name, _ = os.path.splitext(md);

    cmd = ["pandoc", "-f", "markdown","-t", "json", "-o", name+".json", os.path.join("markdown", md)]
    p = subprocess.Popen(cmd)
    p.communicate()
