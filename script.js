document.head.insertAdjacentHTML('beforeend', `
<style>
.video-container {
  position: relative;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  height: 0;
  overflow: hidden;
  max-width: 100%;
  margin: 20px 0;
}
.video-container iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
</style>
`);

async function generatePlan() {
  const className = document.getElementById('classInput').value;
  const hours = document.getElementById('hoursInput').value;
  const level = document.getElementById('levelInput').value;

  if (!className || !hours || !level) {
    alert('Please fill out all fields');
    return;
  }

  if (hours <= 0) {
    alert('Hours must be a positive number');
    return;
  }

  if (level < 1 || level > 10) {
    alert('Level must be a number between 1 and 10');
    return;
  }

  const button = document.querySelector('button');
  const originalButtonText = button.textContent;
  button.textContent = 'Generating...';
  button.disabled = true;

  try {
    const response = await fetch('/generate-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ className, hours, level })
    });

    const data = await response.json();

    if (data.error) {
      alert(`Error: ${data.error}`);
    } else {
      // ✅ Convert markdown to HTML using marked
      const markdownHTML = marked.parse(data.message);
      document.getElementById('studyPlan').innerHTML = markdownHTML;

      // Process YouTube links after the content is added to the DOM
      processYoutubeEmbeds();

      document.getElementById('planSection').classList.remove('hidden');
      document.getElementById('planSection').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    button.textContent = originalButtonText;
    button.disabled = false;
  }
}

// Function to process YouTube embeds
function processYoutubeEmbeds() {
  const studyPlan = document.getElementById('studyPlan');
  const videoTitles = studyPlan.innerHTML.match(/\*\*YouTube Video #\d+:\*\*/g);
  if (!videoTitles) return;

  const youtubeLinksPattern = /https:\/\/www\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g; 
  const content = studyPlan.innerHTML;
  let youtubeLinks = [];
  let match;

  while ((match = youtubeLinksPattern.exec(content)) !== null) {
    youtubeLinks.push({
      fullLink: match[0],
      videoId: match[1]
    });
  }

  if (youtubeLinks.length === 0) return;

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;

  function getTextNodesIn(node) {
    var textNodes = [];
    if (node.nodeType == 3) {
      textNodes.push(node);
    } else {
      var children = node.childNodes;
      for (var i = 0; i < children.length; i++) {
        textNodes.push.apply(textNodes, getTextNodesIn(children[i]));
      }
    }
    return textNodes;
  }

  const textNodes = getTextNodesIn(tempDiv);
  let processedLinks = [];

  for (let i = 0; i < videoTitles.length; i++) {
    let titleTextNode = null;
    let titleNodeIndex = -1;

    for (let j = 0; j < textNodes.length; j++) {
      if (textNodes[j].textContent.includes(videoTitles[i])) {
        titleTextNode = textNodes[j];
        titleNodeIndex = j;
        break;
      }
    }

    if (!titleTextNode) continue;

    let youtubeLink = null;
    for (let j = 0; j < youtubeLinks.length; j++) {
      if (!processedLinks.includes(j)) {
        youtubeLink = youtubeLinks[j];
        processedLinks.push(j);
        break;
      }
    }

    if (!youtubeLink) continue;

    const embedDiv = document.createElement('div');
    embedDiv.className = 'video-container';
    embedDiv.innerHTML = `
      <iframe 
        width="560" 
        height="315" 
        src="https://www.youtube.com/embed/${youtubeLink.videoId}" 
        title="YouTube video player" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    `;

    let handled = false;
    let htmlContent = studyPlan.innerHTML;

    const titlePos = htmlContent.indexOf(videoTitles[i]);
    if (titlePos !== -1) {
      const afterTitlePos = titlePos + videoTitles[i].length;
      const newContent = htmlContent.substring(0, afterTitlePos) + 
                         embedDiv.outerHTML + 
                         htmlContent.substring(afterTitlePos);
      studyPlan.innerHTML = newContent;
      handled = true;
    }

    if (!handled) {
      htmlContent = studyPlan.innerHTML;
      const linkPos = htmlContent.indexOf(youtubeLink.fullLink);
      if (linkPos !== -1) {
        const newContent = htmlContent.substring(0, linkPos) + 
                           embedDiv.outerHTML + 
                           htmlContent.substring(linkPos);
        studyPlan.innerHTML = newContent;
      }
    }
  }
}
